import {makeProject} from '@motion-canvas/core';
import keys from './explainer?scene';
import mitm from './mitm?scene';
import modes from './modes?scene';
const topic=new URLSearchParams(location.search).get('topic');
export default makeProject({scenes:[topic==='mitm'?mitm:topic==='modes'?modes:keys]});
