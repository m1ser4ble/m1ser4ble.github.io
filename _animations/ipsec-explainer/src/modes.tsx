import {Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, useThread, waitFor} from '@motion-canvas/core';
const C={bg:'#090f1d',panel:'#142239',text:'#eaf2ff',muted:'#9bb0cc',public:'#f3bd65',secure:'#56e3ba'};
export default makeScene2D(function* (view) {
 const title=createRef<Txt>(),hint=createRef<Txt>(),original=createRef<Rect>(),outer=createRef<Rect>(),encrypted=createRef<Rect>(),encLabel=createRef<Txt>(),tcp=createRef<Rect>(),data=createRef<Rect>(),p2p=createRef<Rect>();
 const left=createRef<Txt>(),right=createRef<Txt>(),badge=createRef<Txt>();
 view.fill(C.bg);view.fontFamily('sans-serif');
 view.add(<>
 <Txt text="PACKET BOUNDARIES" y={-318} fontSize={20} fill={C.muted}/>
 <Txt ref={title} text="ORIGINAL · hostA → hostB" y={-262} fontSize={40} fontWeight={700} fill={C.text}/>
 <Txt ref={left} text="hostA" x={-500} y={-164} fontSize={31} fill={C.public}/>
 <Txt ref={right} text="hostB" x={500} y={-164} fontSize={31} fill={C.public}/>
 <Line points={[[-390,-164],[390,-164]]} endArrow arrowSize={13} stroke={C.muted} lineWidth={3}/>
 <Txt ref={badge} text="Original packet" y={-104} fontSize={25} fill={C.muted}/>
 <Rect ref={encrypted} x={190} y={0} width={730} height={232} radius={18} fill="#153b35" stroke={C.secure} lineWidth={3} opacity={0}>
 <Txt ref={encLabel} text="ENCRYPTED: TCP + DATA" y={-85} fontSize={27} fill={C.secure}/>
 </Rect>
 <Rect ref={outer} x={-445} y={16} width={310} height={154} radius={12} fill="#3b301b" stroke={C.public} lineWidth={2} opacity={0}>
 <Txt text="NEW outer IP
gwA → gwB" fontSize={28} fill={C.public} lineHeight={43} textAlign="center"/>
 </Rect>
 <Rect ref={original} x={-390} y={16} width={340} height={140} radius={12} fill={C.panel} stroke={C.public} lineWidth={2}>
 <Txt text="Original IP
hostA → hostB" fontSize={29} fill={C.text} lineHeight={44} textAlign="center"/>
 </Rect>
 <Rect ref={tcp} x={0} y={16} width={220} height={140} radius={12} fill={C.panel} stroke={C.muted} lineWidth={2}><Txt text="TCP" fontSize={32} fill={C.text}/></Rect>
 <Rect ref={data} x={350} y={16} width={300} height={140} radius={12} fill={C.panel} stroke={C.muted} lineWidth={2}><Txt text="DATA" fontSize={32} fill={C.text}/></Rect>
 <Txt ref={hint} text="Start with the same original IP packet" y={203} fontSize={29} fill={C.text}/>
 <Txt text="Conceptual encryption boundaries · ESP fields omitted" y={303} fontSize={21} fill={C.muted}/>
 <Rect ref={p2p} y={44} width={1160} height={360} radius={20} fill={C.bg} opacity={0}>
 <Txt text="TOPOLOGY: P2P" y={-117} fontSize={37} fontWeight={700} fill={C.public}/>
 <Txt text="is independent of" y={-57} fontSize={28} fill={C.muted}/>
 <Rect x={-285} y={40} width={490} height={115} radius={15} fill={C.panel} stroke={C.secure} lineWidth={2}><Txt text="TRANSPORT" fontSize={33} fill={C.secure}/></Rect>
 <Rect x={285} y={40} width={490} height={115} radius={15} fill={C.panel} stroke={C.secure} lineWidth={2}><Txt text="TUNNEL" fontSize={33} fill={C.secure}/></Rect>
 </Rect>
 </>);
 function* phase(heading:string,action:()=>Generator<any,void,any>){const start=useThread().time();title().text(heading);yield* action();yield* waitFor(Math.max(0,6-(useThread().time()-start)));}
 yield* phase('ORIGINAL · hostA → hostB',function*(){yield* all(original().position.x(-375,0.6).to(-390,0.6),data().position.x(365,0.6).to(350,0.6));});
 yield* phase('TRANSPORT · keep original outer IP',function*(){badge().opacity(0);badge().text('Outer addresses: hostA → hostB');hint().text('Original IP stays visible. TCP + data become encrypted.');yield* all(encrypted().opacity(1,0.8),tcp().fill('#23594d',0.8),data().fill('#23594d',0.8));yield* all(tcp().position.x(20,0.7),data().position.x(370,0.7));});
 yield* phase('TUNNEL · add a new outer IP',function*(){left().text('gwA');right().text('gwB');badge().text('Outer addresses: gwA → gwB');encLabel().text('ENCRYPTED: ORIGINAL IP + TCP + DATA');hint().text('Original host addresses remain inside the encrypted packet.');yield* all(encrypted().position.x(180,0.9),encrypted().width(840,0.9),original().position.x(-55,0.9),tcp().position.x(250,0.9),tcp().width(180,0.9),data().position.x(450,0.9),data().width(160,0.9),original().fill('#23594d',0.9),original().stroke(C.secure,0.9),outer().opacity(1,0.9));});
 yield* phase('TOPOLOGY ≠ ENCAPSULATION',function*(){[original(),outer(),tcp(),data(),encrypted()].forEach(n=>n.opacity(0));left().text('peerA');right().text('peerB');hint().position.y(256);hint().text('Host-to-host can also use tunnel mode.');badge().text('Choose topology and packet format separately.');yield* p2p().opacity(1,0.7);});
});
