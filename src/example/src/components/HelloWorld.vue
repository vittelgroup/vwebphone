<script setup lang="ts">
import { Ref, ref } from 'vue'
import { useWebphone } from "../../../webphone/useWebphone";

const localStream = ref<HTMLMediaElement | null>(null);
const remoteStream = ref<HTMLMediaElement | null>(null);

defineProps<{ msg: string }>()

const { hangup,
  answer,
  startCall,
  unregister,
  toggleHold,
  toggleMute,
  sendDTMF,
  register,
  error,
  janusStatus,
  registerStatus,
  extenStatus,
  inCallStatus, } = useWebphone({
    domain: import.meta.env.VITE_SIP_DOMAIN,
    extension: import.meta.env.VITE_SIP_EXTENSION,
    secret: import.meta.env.VITE_SIP_SECRET,
    port: parseInt(import.meta.env.VITE_SIP_PORT),
    name: '4010 - Teste',
    janusServer: import.meta.env.VITE_JANUS_HOST,
    janusPort: parseInt(import.meta.env.VITE_JANUS_PORT),
    janusEndpoint: '/janus',
    janusProtocol: 'wss',
    transport: 'udp',
    debug: 'all',
    localStreamElement: localStream as Ref<HTMLMediaElement>,
    remoteStreamElement: remoteStream as Ref<HTMLMediaElement>
  });

console.log({ registerStatus, janusStatus, extenStatus, inCallStatus });

</script>

<template>
  <h1>{{ msg }}</h1>
  <h4>JANUS: {{ janusStatus }}</h4>
  <h4>EXTENSION REGISTER: {{ registerStatus }}</h4>
  <h4>EXTENSION: {{ extenStatus }}</h4>
  <h4>NUMBER: {{ inCallStatus.status?.number }}</h4>
  <h4>InCall? {{ inCallStatus.inCall ? 'YES' : 'NO' }}</h4>
  <h4>ERROR: {{ error?.msg }}</h4>

  <div class="card">
    <button type="button" @click="answer" :disabled="extenStatus !== 'incomingcall'">Answer</button>
    <button type="button" @click="hangup" :disabled="!inCallStatus.inCall">Hangup</button>
    <button type="button" @click="toggleMute" :disabled="!inCallStatus.inCall">Toggle Mute</button>
    <button type="button" @click="toggleHold" :disabled="!inCallStatus.inCall">Toggle Hold</button>
    <button type="button" @click="sendDTMF('*2')" :disabled="!inCallStatus.inCall">Send DTMF</button>
    <button type="button" @click="unregister" :disabled="registerStatus !== 'registered'">Unregister</button>
    <button type="button" @click="register"
      :disabled="registerStatus === 'registered' || registerStatus === 'registering'">Register</button>
    <button type="button" @click="startCall('011992242283')" :disabled="inCallStatus.inCall">Call 11992242283</button>

    <audio ref="localStream" style="display: none" playsinline autoplay muted></audio>
    <audio ref="remoteStream" style="display: none" playsinline autoplay></audio>

  </div>

  <p class="read-the-docs">This is an example for using a Webphone with <a
      href="https://janus.conf.meetecho.com/">Janus</a> <a href="https://digital.vittel.com.br/produtos/"
      target="_blank">@Vittel</a></p>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
