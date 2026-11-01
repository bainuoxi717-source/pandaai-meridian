import * as THREE from 'three';
export function addIdentity(scene:THREE.Object3D){
 const coral=new THREE.MeshStandardMaterial({color:'#b68159',roughness:.66,metalness:.25});
 const pale=new THREE.MeshStandardMaterial({color:'#d8e0e7',roughness:.7});
 const ink=new THREE.MeshStandardMaterial({color:'#24374f',metalness:.55,roughness:.45});
 const add=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const p=new THREE.Mesh(g,m);p.position.set(x,y,z);p.castShadow=p.receiveShadow=true;scene.add(p);return p;};
 for(let n=0;n<6;n++){
 const x=-10+n*.67,z=13;add(new THREE.BoxGeometry(.58,2.2,.7),ink,x,1.1,z);
 for(let k=0;k<7;k++){add(new THREE.BoxGeometry(.5,.24,.72),k%2?pale:coral,x,.2+k*.29,z);add(new THREE.BoxGeometry(.18,.045,.03),ink,x,.23+k*.29,z+.38);}
}add(new THREE.TorusGeometry(1.6,.09,10,32),coral,-8,4,12);
}
