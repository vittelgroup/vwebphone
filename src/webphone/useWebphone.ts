import { ref, onMounted, onUnmounted, unref, Ref, watch } from "vue";
import Janus from "../lib/janus";
import type { JanusJS } from "../lib/janus";
interface WebphoneProps {
  janusServer: string;
  name: string;
  domain: string;
  extension: string;
  secret: string;
  port: number;
  janusPort: number;
  janusEndpoint: string;
  janusProtocol: string;
  transport: "udp" | "tcp";
  proxy?: string;
  debug?: boolean | "all" | JanusJS.DebugLevel[];
  localStreamElement: Ref<HTMLMediaElement | null>;
  remoteStreamElement: Ref<HTMLMediaElement | null>;
  iceServers?: RTCIceServer[];
  withCredentials?: boolean;
  token?: string;
  apisecret?: string;
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
  const JSEP = ref<null | JanusJS.JSEP>(null);
  const janusOptions = unref(config);
  const { janusStatus, registerStatus, extenStatus, inCallStatus } = {
    janusStatus: ref<JanusStatus>(JanusStatus.NOT_CONNECTED),
    registerStatus: ref<RegisterStatus>(RegisterStatus.UNREGISTERED),
    extenStatus: ref<ExtenStatus>(ExtenStatus.OFFLINE),
    inCallStatus: ref<InCall>({
      inCall: false,
      status: undefined,
    }),
  };

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
              Contact: `<sip:${janusOptions.extension}@${janusOptions.janusServer}>`,
            },
          };
          sip.value?.send({
            message: body,
            jsep: newJsep,
          });
        },
        error(err: any) {
          error.value = {
            type: "onAnswer",
            msg: JSON.stringify(err),
          };
          inCallStatus.value = {
            inCall: false,
            status: undefined,
          };
          extenStatus.value = ExtenStatus.IDLE;
          const body = { request: "decline", code: 480 };
          sip.value?.send({ message: body });
        },
      });
    }
  }

  function unregister() {
    if (sip.value) {
      sip.value.send({ message: { request: "unregister" } });
    }
  }

  function register() {
    if (
      sip.value &&
      registerStatus.value !== RegisterStatus.REGISTERED &&
      registerStatus.value !== RegisterStatus.REGISTERING
    ) {
      sip.value.send({
        message: {
          authuser: janusOptions.extension,
          request: "register",
          username: `sip:${janusOptions.extension}@${janusOptions.domain}:${janusOptions.port}`,
          display_name: janusOptions.name,
          secret: janusOptions.secret,
          force_tcp: janusOptions.transport === "tcp",
          force_udp: janusOptions.transport === "udp",
          proxy: `sip:${janusOptions.domain}:${janusOptions.port}`,
        },
      });
    }
  }
  function startCall(dialNumber: string) {
    if (sip.value) {
      talkingNumber.value = dialNumber;
      sip.value.createOffer({
        media: {
          audioSend: true,
          audioRecv: true,
          videoSend: false,
          videoRecv: false,
        },
        success(newJsep: JanusJS.JSEP) {
          console.log("Got SDP on creating!");
          const body = {
            request: "call",
            uri: `sip:${dialNumber}@${janusOptions.domain}:${janusOptions.port}`,
          };
          sip.value?.send({ message: body, jsep: newJsep });
        },
        error(err: any) {
          error.value = {
            type: "onStartCall",
            msg: JSON.stringify(err),
          };
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
    }
  }

  function toggleHold() {
    if (sip.value && inCallStatus.value.status) {
      const request = inCallStatus.value.status.onHold ? "unhold" : "hold";
      sip.value.send({ message: { request } });
      inCallStatus.value.status.onHold = request === "hold";
    }
  }

  function sendDTMF(dtmfToSend: string) {
    if (sip.value) {
      sip.value.dtmf({ dtmf: { tones: dtmfToSend } });
    }
  }

  // Initialize Janus
  function bootstrap() {
    Janus.init({
      debug: janusOptions.debug,
      callback: (): void => {
        janusStatus.value = JanusStatus.CONNECTING;
        if (!Janus.isWebrtcSupported()) {
          error.value = {
            type: "onJanusInit",
            msg: "WebRTC not supported",
          };
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
                register();
              },
              onmessage: (msg: JanusJS.Message, jsep) => {
                if (jsep) {
                  JSEP.value = jsep;
                }
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
                      extenStatus.value = ExtenStatus.IDLE;
                      registerStatus.value = RegisterStatus.REGISTERED;
                      break;
                    case "registration_failed":
                      registerStatus.value = RegisterStatus.REGISTRATION_FAILED;
                      break;
                    case "unregistered":
                      registerStatus.value = RegisterStatus.UNREGISTERED;
                      break;
                    case "unregistering":
                      registerStatus.value = RegisterStatus.UNREGISTERING;
                      break;
                    case "registering":
                      registerStatus.value = RegisterStatus.REGISTRATION_FAILED;
                      break;
                    default:
                      registerStatus.value = RegisterStatus.UNREGISTERED;
                      break;
                  }
                } else if (msg.result?.event === "calling") {
                  const number = talkingNumber.value || "";
                  extenStatus.value = ExtenStatus.CALLING;
                  inCallStatus.value = {
                    inCall: true,
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
                    console.log("PROGRESS", jsep, sip.value);
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
                  console.log("UPDATINGCALL", jsep, sip.value);

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
                      console.log(
                        `Got SDP ${String(
                          jsep2.type
                        )}! audio=${hasAudio}, video=${hasVideo}`
                      );
                      const body = { request: "update" };
                      sip.value?.send({ message: body, jsep });
                    },
                    error(err: any) {
                      error.value = {
                        type: "onUpdatingCall",
                        msg: JSON.stringify(err),
                      };
                      console.log("PROGRESS (ERROR)", jsep, sip.value);
                    },
                  });
                } else if (msg.result?.event === "hangup") {
                  console.log("HANGUP", jsep, sip.value);

                  extenStatus.value = ExtenStatus.IDLE;
                  inCallStatus.value = {
                    inCall: false,
                    status: undefined,
                  };
                }
              },

              onlocalstream: (stream: any) => {
                console.log("LOCAL STREAM:   ", stream);

                if (janusOptions.localStreamElement.value) {
                  Janus.attachMediaStream(
                    janusOptions.localStreamElement.value,
                    stream
                  );
                }
              },
              onremotestream: (stream: any) => {
                console.log("REMOTE STREAM:   ", stream);
                if (janusOptions.remoteStreamElement.value) {
                  Janus.attachMediaStream(
                    janusOptions.remoteStreamElement.value,
                    stream
                  );
                }
              },
              oncleanup: () => {
                console.log("Got cleanup notification");
              },
              detached: () => {
                janusStatus.value = JanusStatus.NOT_CONNECTED;
                extenStatus.value = ExtenStatus.OFFLINE;
                inCallStatus.value = {
                  inCall: false,
                  status: undefined,
                };
                registerStatus.value = RegisterStatus.UNREGISTERED;
              },
              error: (err: any) => {
                janusStatus.value = JanusStatus.ERROR;
                extenStatus.value = ExtenStatus.OFFLINE;
                inCallStatus.value = {
                  inCall: false,
                  status: undefined,
                };
                registerStatus.value = RegisterStatus.UNREGISTERED;
                error.value = {
                  type: "onJanusAttach",
                  msg: JSON.stringify(err),
                };
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
            };
            registerStatus.value = RegisterStatus.UNREGISTERED;
            error.value = {
              type: "onJanusRunning",
              msg: JSON.stringify(err),
            };
          },
          destroyed: () => {
            janusStatus.value = JanusStatus.NOT_CONNECTED;
            extenStatus.value = ExtenStatus.OFFLINE;
            inCallStatus.value = {
              inCall: false,
              status: undefined,
            };
            registerStatus.value = RegisterStatus.UNREGISTERED;
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

    watch(registerStatus, () => {
      if (registerStatus.value === RegisterStatus.REGISTERED && error.value) {
        error.value = null;
      }
    });
  });

  onUnmounted(() => {
    webphone.value?.destroy();
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
    error,
    janusStatus,
    registerStatus,
    extenStatus,
    inCallStatus,
  };
}
