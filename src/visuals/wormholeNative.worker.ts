import { createNativeWorkerHost } from './WormholeNativeWorkerHost';
import type { NativeWorkerRequest, NativeWorkerResponse } from '../types/WormholeNativeWorkerProtocol';
interface NativeWorkerScope {
    onmessage:((event:MessageEvent<NativeWorkerRequest>)=>void)|null;
    postMessage(message:NativeWorkerResponse, transfer?:ArrayBuffer[]):void;
}
const scope=self as unknown as NativeWorkerScope;
const host=createNativeWorkerHost((message,transfer)=>scope.postMessage(message,transfer));
scope.onmessage=event=>{void host.receive(event.data);};
