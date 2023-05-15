<script setup lang="ts">
import { Ref, ref } from 'vue'
import { useWebphone } from "../../../webphone/useWebphone";

const localStream = ref<HTMLMediaElement | null>(null);
const remoteStream = ref<HTMLMediaElement | null>(null);
const numberToCall = ref("");
const dtmf = ref("");

const sipStatus = {
  unregistered: 'Não Registrado',
  registration_failed: 'Registrou falhou',
  registered: 'Registrado',
  registering: 'Registrando...',
  unregistering: 'Desconectando...',
}

const wssStatus = {
  not_connected: 'Desconectado',
  connecting: 'Conectando...',
  connected: 'Conectado',
  error: 'ERRO',
}

const ramalStatus = {
  incall: 'Em Chamada',
  calling: 'Chamando...',
  idle: 'Livre',
  offline: 'Desconectado',
  incomingcall: 'Recebendo Chamada',
}

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
  <div class="overflow-hidden rounded-lg bg-white shadow w-[600px]">
    <div class="p-6 transition-all ease-in-out border border-white"
      :class="{ 'bg-green-400': inCallStatus.inCall, 'bg-white': !inCallStatus.inCall }">
      <div class="sm:flex sm:items-center sm:justify-between">
        <div class="sm:flex sm:space-x-5">
          <div class="flex-shrink-0">
            <img class="mx-auto h-20 w-20 rounded-full"
              src="https://api.dicebear.com/6.x/lorelei/svg?flip=false&seed=asdasd"
              alt="draw of a person in black and white" />
          </div>
          <div class="mt-4 text-center sm:mt-0 sm:pt-1 sm:text-left">
            <p class="text-sm font-medium text-gray-600">4010</p>
            <p class="text-xl font-bold text-gray-900 sm:text-2xl">4010 - Teste</p>
            <p class="text-sm font-medium text-gray-600">
              vcm.vcmpbx.com.br</p>
          </div>
        </div>

      </div>
    </div>
    <div
      class="mt-5 flex justify-center flex-row sm:mt-0 space-x-1 divide-y divide-gray-200 border-t border-gray-200 py-2 px-2">
      <button type="button" class="incall-button" :disabled="inCallStatus.inCall || numberToCall === ''"
        @click="startCall(numberToCall)">Ligar</button>
      <input type="text" placeholder="5511995653232" class="rounded-md px-2 w-52" v-model="numberToCall" />
      <button type="button" class="incall-button" :disabled="!inCallStatus.inCall || dtmf === ''"
        @click="() => { sendDTMF(dtmf); dtmf = ''; }">DTMF</button>
      <input type="text" placeholder="*2" class="rounded-md px-2 w-52" v-model="dtmf" :disabled="!inCallStatus.inCall" />
    </div>
    <div
      class="mt-5 flex justify-center flex-row sm:mt-0 space-x-1 divide-y divide-gray-200 border-t border-gray-200 py-2">
      <button type="button" class="action-button" :disabled="!inCallStatus.inCall" @click="hangup">Desligar</button>
      <button type="button" class="action-button" :disabled="extenStatus !== 'incomingcall'"
        @click="answer">Atender</button>
      <button type="button" class="action-button" :disabled="!inCallStatus.inCall" @click="toggleMute">Mudo</button>
      <button type="button" class="action-button" :disabled="!inCallStatus.inCall" @click="toggleHold">Espera</button>
    </div>
    <div
      class="grid grid-cols-1 divide-y divide-gray-200 border-t border-gray-200 bg-gray-50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <div class="px-6 py-5 text-center text-sm font-medium">
        <span class="text-gray-600">SIP</span>
        {{ ' ' }}
        <span
          :class="{ 'text-green-700': registerStatus === 'registered', 'text-gray-600': registerStatus !== 'registered' }">{{
            sipStatus[registerStatus] || 'Não Registrado' }}</span>

      </div>
      <div class="px-6 py-5 text-center text-sm font-medium">
        <span class="text-gray-600">WSS</span>
        {{ ' ' }}
        <span :class="{ 'text-green-700': janusStatus === 'connected', 'text-gray-600': janusStatus !== 'connected' }">{{
          wssStatus[janusStatus] || 'Desconectado' }}</span>

      </div>
      <div class="px-6 py-5 text-center text-sm font-medium">
        <span class="text-gray-600">Ramal</span>
        {{ ' ' }}
        <span :class="{ 'text-green-700': extenStatus !== 'offline', 'text-gray-600': extenStatus === 'offline' }">{{
          ramalStatus[extenStatus] || 'Desconectado' }}</span>

      </div>
    </div>
    <div
      class="mt-5 flex justify-start flex-row sm:mt-0 px-2 space-x-1divide-gray-200 border-t border-gray-200 py-2 bg-red-500"
      v-show="error !== null">
      <span class="text-gray-900 font-bold">{{ error?.type }}</span>
      {{ ' ' }}
      <span class="text-gray-900">{{ error?.msg }}</span>
    </div>
  </div>

  <p class="read-the-docs">This is an example using a Webphone with <a href="https://janus.conf.meetecho.com/">Janus</a>
    {{ ' ' }}
    <a href="https://digital.vittel.com.br/produtos/" target="_blank">@Vittel</a>
  </p>

  <audio class="rounded centered" ref="localStream" width="320" height="240" autoplay playsinline muted
    style="display: none"></audio>
  <audio class="rounded centered" ref="remoteStream" width="320" height="240" autoplay playsinline
    style="display: none"></audio>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
