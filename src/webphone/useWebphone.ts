import {
  ref,
  onMounted,
  onUnmounted,
  unref,
  Ref,
  watch,
  watchEffect,
} from "vue";
import Janus from "../lib/janus";
import type { JanusJS } from "../lib/janus";
interface WebphoneProps {
  janusServer: string;
  janusPort: number;
  janusEndpoint: string;
  janusProtocol: string;
  proxy?: string;
  debug?: boolean | "all" | JanusJS.DebugLevel[] | "minimal";
  localStreamElement: Ref<HTMLMediaElement | null>;
  remoteStreamElement: Ref<HTMLMediaElement | null>;
  iceServers?: RTCIceServer[];
  withCredentials?: boolean;
  token?: string;
  apisecret?: string;
  registerTimeout: number;
}

enum JanusStatus {
  NOT_CONNECTED = "not_connected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ERROR = "error",
}

enum RegisterStatus {
  UNREGISTERED = "unregistered",
  REGISTRATION_FAILED = "registration_failed",
  REGISTERED = "registered",
  REGISTERING = "registering",
  UNREGISTERING = "unregistering",
}

enum ExtenStatus {
  INCALL = "incall",
  CALLING = "calling",
  IDLE = "idle",
  OFFLINE = "offline",
  RECEIVING_CALL = "incomingcall",
}

interface InCallStatus {
  muted: boolean;
  onHold: boolean;
  number: string;
  onSpeaker: boolean;
  incallId: string;
  duration: number;
  callDirection: "incoming" | "outgoing";
}

interface InCallProps {
  inCall: boolean;
  hangupReason: string;
  status?: InCallStatus;
}

type InCall = InCallProps;

/**
 * Webphone composable for VueJS
 *
 * @param {WebphoneProps} config - Configuration options for the webphone
 *
 * @returns {Object} - Object with webphone functions and status properties
 */
export function useWebphone(config: WebphoneProps) {
  const opaqueId = ref(crypto.randomUUID());
  const error = ref<null | { type: string; msg: string }>(null);
  const isOnline = ref(window.navigator.onLine);
  const talkingNumber = ref<null | string>(null);
  const webphone = ref<null | Janus>(null);
  const sip = ref<null | JanusJS.PluginHandle>(null);
  const registerTimer = ref(0);
  const registerTimerId = ref(0);

  const authenticatedExtension = ref<null | string>(null);
  const authenticatedDomain = ref<null | string>(null);
  const authenticatedPort = ref<null | number>(null);

  const JSEP = ref<null | JanusJS.JSEP>(null);
  const janusOptions = unref(config);
  const { janusStatus, registerStatus, extenStatus, inCallStatus } = {
    janusStatus: ref<JanusStatus>(JanusStatus.NOT_CONNECTED),
    registerStatus: ref<RegisterStatus>(RegisterStatus.UNREGISTERED),
    extenStatus: ref<ExtenStatus>(ExtenStatus.OFFLINE),
    inCallStatus: ref<InCall>({
      inCall: false,
      status: undefined,
      hangupReason: "",
    }),
  };

  function wpDebug(): Console {
    const noop = new Proxy({}, { get: () => () => void 0 });

    return janusOptions.debug === true || janusOptions.debug === "minimal"
      ? console
      : (noop as Console);
  }

  function updateNetworkStatus() {
    isOnline.value = window.navigator.onLine;
  }

  onMounted(() => {
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
  });

  onUnmounted(() => {
    window.removeEventListener("online", updateNetworkStatus);
    window.removeEventListener("offline", updateNetworkStatus);
  });

  function hangup() {
    if (
      sip.value &&
      extenStatus.value !== ExtenStatus.OFFLINE &&
      extenStatus.value !== ExtenStatus.IDLE
    ) {
      const request =
        extenStatus.value === ExtenStatus.RECEIVING_CALL ? "decline" : "hangup";
      sip.value.send({ message: { request } });
      sip.value.hangup();
    }
  }

  function answer() {
    if (sip.value) {
      let hasAudio = true;
      let hasVideo = true;
      let offerlessInvite = false;
      if (JSEP.value) {
        hasAudio = JSEP.value.sdp.indexOf("m=audio ") > -1;
        hasVideo = JSEP.value.sdp.indexOf("m=video ") > -1;
      } else {
        offerlessInvite = true;
        hasVideo = false;
      }
      const sipcallAction = offerlessInvite
        ? sip.value.createOffer
        : sip.value.createAnswer;

      sipcallAction({
        jsep: JSEP.value,
        media: { audio: hasAudio, video: hasVideo },
        success: (newJsep: any) => {
          const body = {
            request: "accept",
            headers: {
              Contact: `<sip:${authenticatedExtension.value}@${janusOptions.janusServer}>`,
            },
          };
          sip.value?.send({
            message: body,
            jsep: newJsep,
          });
        },
        error(err: any) {
          wpDebug().error("[WEBPHONE]:answer():", JSON.stringify(err));
          inCallStatus.value = {
            inCall: false,
            status: undefined,
            hangupReason: "",
          };
          extenStatus.value = ExtenStatus.IDLE;
          const body = { request: "decline", code: 480 };
          sip.value?.send({ message: body });
        },
      });
      wpDebug().log("[WEBPHONE]:Function answer() called");
    }
  }

  function unregister() {
    if (sip.value) {
      wpDebug().log("[WEBPHONE]:Function unregister() called");
      sip.value.send({ message: { request: "unregister" } });
    }
  }

  function registerTimerStart() {
    wpDebug().log(
      "[WEBPHONE]:Function registerTimerStart() called",
      registerStatus.value,
      registerTimer.value
    );
    if (
      [
        RegisterStatus.UNREGISTERED,
        RegisterStatus.REGISTERING,
        RegisterStatus.REGISTRATION_FAILED,
      ].includes(registerStatus.value)
    ) {
      registerTimerId.value = setTimeout(() => {
        registerTimer.value = registerTimer.value + 1;
        registerTimerStart();
      }, 1000);
    }
  }
  function register({
    authuser,
    secret,
    domain,
    port,
    name,
    transport,
  }: {
    authuser: string;
    secret: string;
    domain: string;
    port: number;
    name: string;
    transport: "udp" | "tcp";
  }) {
    if (
      sip.value &&
      registerStatus.value !== RegisterStatus.REGISTERED &&
      registerStatus.value !== RegisterStatus.REGISTERING &&
      registerTimer.value <= 0
    ) {
      sip.value.send({
        message: {
          authuser,
          request: "register",
          username: `sip:${authuser}@${domain}:${port}`,
          display_name: name,
          secret: secret,
          force_tcp: transport === "tcp",
          force_udp: transport === "udp",
          proxy: `sip:${domain}:${port}`,
        },
      });
      registerTimerStart();
      authenticatedExtension.value = authuser;
      authenticatedDomain.value = domain;
      authenticatedPort.value = port;
      wpDebug().log(
        `[WEBPHONE]:Function register() called 'sip:${authuser}@${domain}:${port}'`
      );
    } else if (registerTimer.value >= 0) {
      registerTimer.value = 0;
    }
  }
  function startCall(dialNumber: string) {
    if (sip.value && dialNumber !== "") {
      wpDebug().log(`[WEBPHONE]:Function startCall(${dialNumber}) called`);
      talkingNumber.value = dialNumber;
      sip.value.createOffer({
        media: {
          audioSend: true,
          audioRecv: true,
          videoSend: false,
          videoRecv: false,
        },
        success(newJsep: JanusJS.JSEP) {
          wpDebug().log("[WEBPHONE]:Got SDP on creating!");
          const body = {
            request: "call",
            uri: `sip:${dialNumber}@${authenticatedDomain.value}:${authenticatedPort.value}`,
          };
          sip.value?.send({ message: body, jsep: newJsep });
        },
        error(err: any) {
          wpDebug().error(
            `[WEBPHONE]:Function startCall(${dialNumber})`,
            JSON.stringify(err)
          );
          Janus.error("WebRTC error...", error);
        },
      });
    }
  }

  function toggleMute() {
    if (sip.value && inCallStatus.value.status) {
      const isMuted = sip.value.isAudioMuted();
      if (isMuted) {
        sip.value.unmuteAudio();
        inCallStatus.value.status.muted = false;
      } else {
        sip.value.muteAudio();
        inCallStatus.value.status.muted = true;
      }
      wpDebug().log(
        `[WEBPHONE]:Function toggleMute() called '${
          isMuted ? "MUTED" : "UNMUTED"
        }'`
      );
    }
  }

  function toggleHold() {
    if (sip.value && inCallStatus.value.status) {
      const request = inCallStatus.value.status.onHold ? "unhold" : "hold";
      sip.value.send({ message: { request } });
      inCallStatus.value.status.onHold = request === "hold";
      wpDebug().log(`[WEBPHONE]:Function toggleHold() called '${request}'`);
    }
  }

  function sendDTMF(dtmfToSend: string) {
    if (sip.value) {
      wpDebug().log(`[WEBPHONE]:Function sendDTMF(${dtmfToSend}) called`);
      sip.value.dtmf({ dtmf: { tones: dtmfToSend } });
    }
  }

  // Initialize Janus
  function bootstrap() {
    if (webphone.value) {
      webphone.value.destroy();
    }
    wpDebug().log(`[WEBPHONE]:Function bootstrap() called`);
    Janus.init({
      debug: janusOptions.debug === "minimal" ? false : janusOptions.debug,
      callback: (): void => {
        janusStatus.value = JanusStatus.CONNECTING;
        if (!Janus.isWebrtcSupported()) {
          wpDebug().error(
            `[WEBPHONE]:Function bootstrap(): WebRTC not supported!`
          );
          janusStatus.value = JanusStatus.ERROR;
          return;
        }
        webphone.value = new Janus({
          server: `${janusOptions.janusProtocol}://${janusOptions.janusServer}:${janusOptions.janusPort}${janusOptions.janusEndpoint}`,
          iceServers: janusOptions.iceServers,
          withCredentials: janusOptions.withCredentials,
          token: janusOptions.token,
          apisecret: janusOptions.apisecret,
          success: () => {
            webphone.value?.attach({
              plugin: "janus.plugin.sip",
              opaqueId: opaqueId.value,
              success: (pluginHandle) => {
                janusStatus.value = JanusStatus.CONNECTED;
                sip.value = pluginHandle;
                wpDebug().log(
                  `[WEBPHONE]:Function bootstrap(): JANUS Connected successfully!`
                );
              },
              onmessage: (msg: JanusJS.Message, jsep) => {
                if (jsep) {
                  JSEP.value = jsep;
                }
                wpDebug().log(
                  `[WEBPHONE]:Function bootstrap(): Message received from Janus:`,
                  msg?.result?.event
                );
                if (
                  msg.result &&
                  msg.result.event &&
                  [
                    "registered",
                    "registration_failed",
                    "unregistered",
                    "unregistering",
                    "registering",
                  ].includes(msg.result.event)
                ) {
                  switch (msg.result.event) {
                    case "registered":
                      if (
                        extenStatus.value === ExtenStatus.IDLE ||
                        extenStatus.value === ExtenStatus.OFFLINE
                      ) {
                        extenStatus.value = ExtenStatus.IDLE;
                      }
                      registerStatus.value = RegisterStatus.REGISTERED;
                      registerTimer.value = 0;
                      break;
                    case "registration_failed":
                      extenStatus.value = ExtenStatus.OFFLINE;
                      registerStatus.value = RegisterStatus.REGISTRATION_FAILED;
                      registerTimer.value = 0;
                      break;
                    case "unregistered":
                      extenStatus.value = ExtenStatus.OFFLINE;
                      registerStatus.value = RegisterStatus.UNREGISTERED;
                      registerTimer.value = 0;
                      break;
                    case "unregistering":
                      registerStatus.value = RegisterStatus.UNREGISTERING;
                      break;
                    case "registering":
                      registerStatus.value = RegisterStatus.REGISTERING;
                      break;
                    default:
                      extenStatus.value = ExtenStatus.OFFLINE;
                      registerStatus.value = RegisterStatus.UNREGISTERED;
                      break;
                  }
                } else if (msg.result?.event === "calling") {
                  const number = talkingNumber.value || "";
                  extenStatus.value = ExtenStatus.CALLING;
                  inCallStatus.value = {
                    inCall: true,
                    hangupReason: "",
                    status: {
                      callDirection: "outgoing",
                      duration: 0,
                      incallId: crypto.randomUUID(),
                      muted: false,
                      number: number,
                      onHold: false,
                      onSpeaker: false,
                    },
                  };
                } else if (msg.result?.event === "incomingcall") {
                  const number = msg.result.username
                    ? msg.result.username.substring(
                        msg.result.username.lastIndexOf(":") + 1,
                        msg.result.username.lastIndexOf("@")
                      )
                    : "";

                  extenStatus.value = ExtenStatus.RECEIVING_CALL;
                  inCallStatus.value = {
                    inCall: true,
                    hangupReason: "",
                    status: {
                      callDirection: "incoming",
                      duration: 0,
                      incallId: crypto.randomUUID(),
                      muted: false,
                      number,
                      onHold: false,
                      onSpeaker: false,
                    },
                  };
                } else if (msg.result?.event === "progress") {
                  if (
                    jsep !== null &&
                    jsep !== undefined &&
                    sip.value !== null
                  ) {
                    wpDebug().log("[WEBPHONE]:PROGRESS", jsep, sip.value);
                    sip.value.handleRemoteJsep({
                      jsep,
                      error: (err: any) => {
                        error.value = {
                          type: "onProgress",
                          msg: JSON.stringify(err),
                        };
                        sip.value?.send({ message: { request: "hangup" } });
                        sip.value?.hangup();
                      },
                    });
                  }
                } else if (msg.result?.event === "accepted") {
                  extenStatus.value = ExtenStatus.INCALL;
                  if (jsep && sip.value) {
                    sip.value.handleRemoteJsep({
                      jsep,
                      error: () => {
                        sip.value?.send({ message: { request: "hangup" } });
                        sip.value?.hangup();
                      },
                    });
                  }
                } else if (msg.result?.event === "updatingcall") {
                  extenStatus.value = ExtenStatus.INCALL;

                  const hasAudio = jsep
                    ? jsep.sdp.indexOf("m=audio") > -1
                    : false;
                  const hasVideo = jsep
                    ? jsep.sdp.indexOf("m=video") > -1
                    : false;
                  sip.value?.createAnswer({
                    jsep,
                    media: { audio: hasAudio, video: hasVideo },
                    success(jsep2: { type: any }) {
                      wpDebug().log(
                        `[WEBPHONE]:Got SDP ${String(
                          jsep2.type
                        )}! audio=${hasAudio}, video=${hasVideo}`
                      );
                      const body = { request: "update" };
                      sip.value?.send({ message: body, jsep });
                    },
                    error(err: any) {
                      wpDebug().error(
                        `[WEBPHONE]:Function bootstrap(): onUpdatingCall`,
                        JSON.stringify(err)
                      );
                    },
                  });
                } else if (msg.result?.event === "hangup") {
                  extenStatus.value = ExtenStatus.IDLE;
                  inCallStatus.value = {
                    inCall: false,
                    status: undefined,
                    hangupReason: msg.result?.reason || "",
                  };
                }
              },

              onlocalstream: (stream: any) => {
                if (janusOptions.localStreamElement.value) {
                  wpDebug().log(
                    `[WEBPHONE]:Function bootstrap(): attaching local stream on`,
                    janusOptions.localStreamElement.value
                  );
                  Janus.attachMediaStream(
                    janusOptions.localStreamElement.value,
                    stream
                  );
                }
              },
              onremotestream: (stream: any) => {
                if (janusOptions.remoteStreamElement.value) {
                  wpDebug().log(
                    `[WEBPHONE]:Function bootstrap(): Attaching remote stream on`,
                    janusOptions.remoteStreamElement.value
                  );
                  Janus.attachMediaStream(
                    janusOptions.remoteStreamElement.value,
                    stream
                  );
                }
              },
              oncleanup: () => {
                wpDebug().log(
                  "[WEBPHONE]:Function bootstrap(): Got cleanup notification"
                );
              },
              detached: () => {
                janusStatus.value = JanusStatus.NOT_CONNECTED;
                extenStatus.value = ExtenStatus.OFFLINE;
                inCallStatus.value = {
                  inCall: false,
                  status: undefined,
                  hangupReason: "",
                };
                registerStatus.value = RegisterStatus.UNREGISTERED;
                wpDebug().warn(
                  `[WEBPHONE]:Function bootstrap(): Plugin detached!`
                );
              },
              error: (err: any) => {
                janusStatus.value = JanusStatus.ERROR;
                extenStatus.value = ExtenStatus.OFFLINE;
                inCallStatus.value = {
                  inCall: false,
                  status: undefined,
                  hangupReason: "",
                };
                registerStatus.value = RegisterStatus.UNREGISTERED;
                wpDebug().error(
                  `[WEBPHONE]:Function bootstrap(): on janus plugin attach`,
                  JSON.stringify(err)
                );
              },
            });
          },
          error: (err: any) => {
            webphone.value?.destroy();
            janusStatus.value = JanusStatus.ERROR;
            extenStatus.value = ExtenStatus.OFFLINE;
            inCallStatus.value = {
              inCall: false,
              status: undefined,
              hangupReason: "",
            };
            registerStatus.value = RegisterStatus.UNREGISTERED;
            wpDebug().error(
              `[WEBPHONE]:Function bootstrap(): on janus running (destroying)`,
              JSON.stringify(err)
            );
          },
          destroyed: () => {
            wpDebug().warn(
              `[WEBPHONE]:Function bootstrap(): Janus instance Destroyed!`
            );
            janusStatus.value = JanusStatus.NOT_CONNECTED;
            extenStatus.value = ExtenStatus.OFFLINE;
            inCallStatus.value = {
              inCall: false,
              status: undefined,
              hangupReason: "",
            };
            if (registerStatus.value !== RegisterStatus.REGISTRATION_FAILED) {
              registerStatus.value = RegisterStatus.UNREGISTERED;
            }
          },
        });
      },
    });
  }

  onMounted(() => {
    watch(
      [isOnline, janusStatus],
      () => {
        if (
          isOnline.value &&
          janusStatus.value !== JanusStatus.CONNECTED &&
          janusStatus.value !== JanusStatus.CONNECTING
        ) {
          bootstrap();
        }
      },
      { immediate: true }
    );

    watchEffect(() => {
      if (registerTimer.value >= janusOptions.registerTimeout) {
        clearTimeout(registerTimerId.value);
        registerTimer.value = 0;
        registerStatus.value = RegisterStatus.REGISTRATION_FAILED;
        wpDebug().warn(`[WEBPHONE]:Register event timeout`);
        webphone.value?.destroy();
      }
    });
  });

  onUnmounted(() => {
    webphone.value?.destroy();
    registerTimer.value = 0;
    clearTimeout(registerTimerId.value);
  });

  return {
    hangup,
    answer,
    startCall,
    unregister,
    toggleMute,
    toggleHold,
    sendDTMF,
    register,
    isOnline,
    janusStatus,
    registerStatus,
    extenStatus,
    inCallStatus,
  };
}
