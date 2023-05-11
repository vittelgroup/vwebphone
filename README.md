# VueJS Vittel Webphone Composable Library

This is a VueJS composable library that provides functionality for implementing a webphone using the Janus server with the sip plugin (sofia). It allows users to make and receive calls, manage call statuses, and control call features such as muting, holding, and switching to speaker mode. It connect to Janus via Websocket and then Janus connect (using sofia-sip plugin) to the PABX (sip engine).

## Installation

To install the library, you can use npm, pnpm or yarn:

```bash
npm install @vittel/webphone
```

or

```bash
pnpm add @vittel/webphone
```

or

```bash
yarn add @vittel/webphone
```

## Usage

Import the composable function into your Vue component:

```javascript
import { useWebphone } from "@vittel/webphone";
```

Use the `useWebphone` composable in your component setup or in the `<script setup>` tag:

```typescript
<script setup lang="ts">
import { ref } from 'vue'
import { useWebphone } from '../webphone';

const localStream = ref<HTMLMediaElement | null>(null);
const remoteStream = ref<HTMLMediaElement | null>(null);

const { hangup,
  answer,
  startCall,
  unregister,
  error,
  janusStatus,
  registerStatus,
  extenStatus,
  inCallStatus, } = useWebphone({
    domain: 'sip.domain.com',
    extension: '200',
    secret: 'secret@200#',
    port: 5060,
    name: '200 - Example',
    janusServer: 'janus.server.com',
    janusPort: 8189,
    janusEndpoint: '/janus',
    janusProtocol: 'wss',
    transport: 'udp',
    debug: 'all',
    localStreamElement: localStream,
    remoteStreamElement: remoteStream
  });
</script>
```

The `useWebphone` composable returns an object with the following properties and functions:

```typescript
{
  hangup: () => void;
  answer: () => void;
  startCall: (numberToDial: string;) => void;
  unregister: () => void;
  error: null | { type: string; msg: string };
  janusStatus: JanusStatus;
  registerStatus: RegisterStatus;
  extenStatus: ExtenStatus;
  inCallStatus: {
   inCall: boolean;
   status?: InCallStatus;
  };
}
```

- `hangup`: Function to end an ongoing call.
- `answer`: Function to answer an incoming call.
- `startCall`: Function to initiate a call.
- `unregister`: Function to unregister from the SIP server.
- `error`: Error object, if any, with `type` and `msg` properties.
- `janusStatus`: Current status of the Janus connection (NOT_CONNECTED, CONNECTING, CONNECTED, ERROR).
- `registerStatus`: Current status of the SIP Registration (UNREGISTERED, REGISTRATION_FAILED, REGISTERED, REGISTERING, UNREGISTERING).
- `extenStatus`: Current status of the registered extension (INCALL, CALLING, IDLE, OFFLINE, RECEIVING_CALL).
- `inCallStatus`: Current status of the active call.

### WebphoneProps

The `WebphoneProps` interface defines the required and optional properties for configuring the webphone:

- `janusServer` (string): The URL of the Janus server.
- `name` (string): The name of the user or device.
- `domain` (string): The domain of the user or device.
- `extension` (string): The extension number associated with the user or device.
- `secret` (string): The secret key for authentication.
- `port` (number): The port number for the webphone server.
- `janusPort` (number): The port number for the Janus server.
- `janusEndpoint` (string): The endpoint URL for the Janus server.
- `janusProtocol` (string): The protocol to be used for communication with the Janus server (e.g., "http" or "https").
- `transport` ("udp" | "tcp"): The transport protocol to be used for the Janus server.
- `proxy` (optional string): The proxy server URL.
- `debug` (optional boolean | "all" | JanusJS.DebugLevel[]): Debug options for the Janus server.
- `localStreamElement` (Ref<HTMLMediaElement | null>): The HTML media element where the local audio/video stream will be displayed (is recommended to leave on mute so you can't hear your own audio/voice).
- `remoteStreamElement` (Ref<HTMLMediaElement | null>): The HTML media element where the remote audio/video stream will be displayed.

### JanusStatus

The `JanusStatus` enum represents the possible connection statuses of the Janus server:

- `NOT_CONNECTED`: The Janus server is not connected.
- `CONNECTING`: The Janus server is connecting.
- `CONNECTED`: The Janus server is connected.
- `ERROR`: An error occurred while connecting to the Janus server.

### RegisterStatus

The `RegisterStatus` enum represents the registration statuses of the webphone:

- `UNREGISTERED`: The webphone is not registered.
- `REGISTRATION_FAILED`: The registration process failed.
- `REGISTERED`: The webphone is successfully registered.
- `REGISTERING`: The webphone is currently in the registration process.
- `UNREGISTERING`: The webphone is currently in the unregistration process.

### ExtenStatus

The `ExtenStatus` enum represents the possible statuses of the extension:

- `INCALL`: The extension is in an active call.
- `CALLING`: The extension is currently making a call.
- `IDLE`: The extension is idle.
- `OFFLINE`: The extension is offline.
- `RECEIVING_CALL`: The extension is receiving an incoming call.

### InCallStatus

The `InCallStatus` interface represents the status information for an ongoing call:

- `muted` (boolean): Indicates whether the call is currently muted.
- `onHold` (boolean): Indicates whether the call is currently on hold.
- `number` (string): The phone number associated with the call.
- `onSpeaker` (boolean): Indicates whether the call is currently on speaker mode.
- `incallId` (string): The ID of the ongoing call.
- `duration` (number): The duration of the ongoing call in seconds.
- `callDirection` (incoming | outgoing): If the call was made by the extension or received.
