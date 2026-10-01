import {Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, useThread, waitFor} from '@motion-canvas/core';
const C={bg:'#090f1d',panel:'#142239',text:'#eaf2ff',muted:'#9bb0cc',psk:'#c6a0ff',public:'#f3bd65',ike:'#72bcff',esp:'#56e3ba'};
export default makeScene2D(function* (view) {
 const heading=createRef<Txt>(),hint=createRef<Txt>(),wire=createRef<Line>(),message=createRef<Rect>(),payload=createRef<Txt>();
 const states:Txt[]=[],trust:Txt[]=[],psks:Rect[]=[],flows:Line[]=[];
 view.fill(C.bg);view.fontFamily('sans-serif');
 view.add(<>
 <Txt text="TWO SECRET PATHS" y={-318} fontSize={20} fill={C.muted}/>
 <Txt ref={heading} text="BEFORE · trusted provisioning" y={-266} fontSize={40} fontWeight={700} fill={C.text}/>
 <Txt ref={hint} text="PSK: authentication credential, not a traffic key" y={310} fontSize={27} fill={C.psk}/>
 <Txt text="PUBLIC CHANNEL" y={-162} fontSize={20} fill={C.public}/>
 <Line ref={wire} points={[[-265,-65],[265,-65]]} endArrow startArrow stroke={C.public} lineWidth={3} opacity={0.3}/>
 {[-435,435].map((x,i)=><>
 <Rect x={x} y={-14} width={330} height={345} radius={22} fill={C.panel} stroke={C.ike} lineWidth={2}>
 <Txt text={i===0?'A · Initiator':'B · Responder'} y={-130} fontSize={30} fontWeight={700} fill={C.text}/>
 <Txt ref={n=>states[i]=n} text="No session keys yet" y={-35} fontSize={29} fill={C.ike} textAlign="center" lineHeight={43}/>
 <Txt ref={n=>trust[i]=n} text="trusted = false" y={128} fontSize={25} fill={C.public}/>
 </Rect>
 <Rect ref={n=>psks[i]=n} x={x} y={232} width={330} height={78} radius={15} fill="#291e40" stroke={C.psk} lineWidth={3}>
 <Txt text="PSK · provisioned BEFORE" fontSize={24} fill={C.psk}/>
 </Rect>
 <Line ref={n=>flows[i]=n} points={[[x,188],[x,147]]} endArrow stroke={C.psk} lineWidth={4} end={0}/>
 </>).flat()}
 <Rect ref={message} y={-65} width={220} height={68} radius={14} fill="#382e1a" stroke={C.public} lineWidth={2} opacity={0}><Txt ref={payload} fontSize={25} fill={C.public}/></Rect>
 <Txt text="LOCAL ONLY" x={-435} y={284} fontSize={15} fill={C.muted}/><Txt text="LOCAL ONLY" x={435} y={284} fontSize={15} fill={C.muted}/>
 </>);
 function* phase(title:string,action:()=>Generator<any,void,any>){const start=useThread().time();heading().text(title);yield* action();yield* waitFor(Math.max(0,6-(useThread().time()-start)));}
 function* send(text:string,from:number,to:number,color:string){payload().text(text);payload().fill(color);message().stroke(color);message().position.x(from);message().opacity(1);wire().opacity(1);yield* message().position.x(to,1.5,easeInOutCubic);yield* message().opacity(0,0.3);}
 yield* phase('BEFORE · trusted provisioning',function*(){yield* all(...psks.map(n=>n.fill('#42265f',0.6).to('#291e40',0.6)));});
 yield* phase('DURING · exchange public DH values',function*(){states[0].text('private a stays local');states[1].text('private b stays local');hint().text('Only KEi / KEr + nonces cross the network');hint().fill(C.public);yield* send('KEi + Ni',-145,145,C.public);yield* send('KEr + Nr',145,-145,C.public);});
 yield* phase('LOCAL · same Z → IKE keys',function*(){wire().opacity(0.15);states.forEach(n=>n.text('Z (local)\n↓ KDF\nIKE keys'));hint().text('Z is computed independently. Keys exist; identity is unverified.');hint().fill(C.ike);yield* all(...states.map(n=>n.fill(C.text,0.7).to(C.ike,0.7)));});
 yield* phase('AUTH · credential binds the exchange',function*(){hint().text('AUTH proof is protected by IKE keys. The PSK itself is never sent.');hint().fill(C.psk);yield* all(...flows.map(n=>n.end(1,0.7)));yield* send('IKE{AUTH}',-145,145,C.ike);yield* send('IKE{AUTH}',145,-145,C.ike);});
 yield* phase('VERIFIED · mutual AUTH succeeds',function*(){trust.forEach(n=>n.text('trusted = true'));hint().text('AUTH verification changes trust — DH alone does not.');hint().fill(C.esp);yield* all(...trust.map(n=>n.fill(C.esp,0.8)),...psks.map(n=>n.stroke(C.esp,0.8)));});
 yield* phase('SEPARATE · derive ESP traffic keys',function*(){states.forEach(n=>n.text('Z → IKE keys\n↓ SK_d + nonces\nESP keys'));hint().text('PSK → AUTH → trust    ≠    Z → IKE → ESP keys');hint().fill(C.esp);wire().opacity(0.15);yield* all(...states.map(n=>n.fill(C.esp,0.9)));});
});
