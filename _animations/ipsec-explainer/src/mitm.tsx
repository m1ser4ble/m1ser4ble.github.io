import {Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, useThread, waitFor} from '@motion-canvas/core';
const C={bg:'#090f1d',panel:'#142239',text:'#eaf2ff',muted:'#9bb0cc',red:'#ff888f',blue:'#72bcff',amber:'#f3bd65'};
export default makeScene2D(function* (view) {
 const title=createRef<Txt>(),hint=createRef<Txt>(),attacker=createRef<Txt>(),verdict=createRef<Rect>();
 const secrets:Rect[]=[],routes:Line[]=[],tokens:Rect[]=[],words:Txt[]=[];
 view.fill(C.bg);view.fontFamily('sans-serif');
 view.add(<>
 <Txt text="UNAUTHENTICATED DH" y={-318} fontSize={20} fill={C.muted}/>
 <Txt ref={title} text="A talks to M. M talks to B." y={-262} fontSize={40} fontWeight={700} fill={C.text}/>
 {[-470,0,470].map((x,i)=><Rect x={x} y={-90} width={i===1?300:250} height={230} radius={20} fill={C.panel} stroke={i===1?C.red:C.blue} lineWidth={3}>
 <Txt text={['A','M · Attacker','B'][i]} y={-68} fontSize={32} fontWeight={700} fill={i===1?C.red:C.text}/>
 <Txt ref={n=>{if(i===1)attacker(n);}} text={i===1?'Replace DH values':'trusted = false'} y={24} fontSize={i===1?25:24} fill={i===1?C.red:C.amber} textAlign="center" lineHeight={36}/>
 </Rect>)}
 {[-1,1].map((side,i)=><Line ref={n=>routes[i]=n} points={[[side*340,-90],[side*150,-90]]} startArrow endArrow arrowSize={12} stroke={i===0?C.blue:C.amber} lineWidth={4}/>)}
 {[-1,1].map((side,i)=><Rect ref={n=>tokens[i]=n} x={side*245} y={-90} width={150} height={56} radius={10} fill={C.panel} stroke={i===0?C.blue:C.amber} lineWidth={2} opacity={0}><Txt ref={n=>words[i]=n} text="DH public" fontSize={22} fill={i===0?C.blue:C.amber}/></Rect>)}
 {[-300,300].map((x,i)=><Rect ref={n=>secrets[i]=n} x={x} y={142} width={530} height={156} radius={16} fill={C.panel} stroke={i===0?C.blue:C.amber} lineWidth={2} opacity={0}>
 <Txt text={i===0?'A ↔ M : Z_AM':'M ↔ B : Z_MB'} y={-38} fontSize={32} fill={i===0?C.blue:C.amber}/>
 <Txt text="IKE keys exist · trusted = false" y={34} fontSize={26} fill={C.text}/>
 </Rect>)}
 <Rect ref={verdict} y={130} width={1110} height={184} radius={18} fill="#321b28" stroke={C.red} lineWidth={4} opacity={0}>
 <Txt text="ABORT · AUTH FAILED" y={-40} fontSize={44} fontWeight={700} fill={C.red}/>
 <Txt text="NO ESP DATA" y={42} fontSize={35} fill={C.text}/>
 </Rect>
 <Txt ref={hint} text="Encrypted channel ≠ authenticated peer" y={298} fontSize={29} fill={C.amber}/>
 </>);
 function* phase(heading:string,action:()=>Generator<any,void,any>){const start=useThread().time();title().text(heading);yield* action();yield* waitFor(Math.max(0,6-(useThread().time()-start)));}
 function* cross(i:number,label:string){words[i].text(label);tokens[i].opacity(1);const side=i===0?-1:1;tokens[i].position.x(side*290);yield* tokens[i].position.x(side*200,1.2,easeInOutCubic);yield* tokens[i].opacity(0,0.3);}
 yield* phase('A talks to M. M talks to B.',function*(){yield* all(cross(0,'DH public'),cross(1,'DH public'));yield* all(cross(0,'M public'),cross(1,'M public'));});
 yield* phase('TWO secrets · Z_AM ≠ Z_MB',function*(){hint().text('M knows both secrets. A and B do not share one secret.');yield* all(...secrets.map(n=>n.opacity(1,0.7)));});
 yield* phase('M has keys — but no credential',function*(){attacker().text('NO PSK\nNO signing key');hint().text('PSK demo; signing-key authentication is an alternative.');yield* attacker().fill(C.text,0.6).to(C.red,0.6);});
 yield* phase('AUTH binds the altered exchange',function*(){hint().text('A valid proof cannot be forged or moved to a different exchange.');yield* cross(0,'IKE{AUTH}');yield* all(...routes.map(n=>n.stroke(C.red,0.6)));attacker().text('AUTH fails');});
 yield* phase('FAIL CLOSED · stop before data',function*(){secrets.forEach(n=>n.opacity(0));routes.forEach(n=>n.opacity(0.3));hint().text('Keys existed. Identity verification failed. No CHILD SA installed.');yield* verdict().opacity(1,0.8);});
});
