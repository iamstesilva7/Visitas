import {getStore} from '@netlify/blobs';
import {createHandler} from '../../server/core.mjs';
export default async (request,context)=>createHandler(getStore,{
  INITIAL_PASSWORD:process.env.INITIAL_PASSWORD,
  CONTEXT:context.deploy?.context||process.env.CONTEXT
})(request,context);
export const config={path:'/api/*'};
