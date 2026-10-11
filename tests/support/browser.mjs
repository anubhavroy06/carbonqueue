import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
export async function launchBrowser(){
 const executablePath=[process.env.CARBONQUEUE_BROWSER,'/usr/local/bin/chromium','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>p&&existsSync(p));
 return chromium.launch({headless:true,args:['--no-sandbox'],...(executablePath?{executablePath}:{})});
}
