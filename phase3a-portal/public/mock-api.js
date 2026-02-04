console.log('🎭 MOCK API LOADED!');
(function(){
  if(!window.location.hostname.includes('demo')&&!window.location.hostname.includes('s3-website')){
    console.log('Not demo mode');
    return;
  }
  console.log('✅ Installing mock fetch');
  window._originalFetch=window.fetch;
  window.fetch=function(url,opts){
    const u=String(url);
    console.log('🎭 Intercepted:',u);
    if(u.includes('.js')||u.includes('.css')||u.includes('.svg')||u.includes('s3-website')||u.includes('amazonaws')){
      console.log('  ✅ Allow');
      return window._originalFetch(url,opts);
    }
    console.log('  🚫 Block - returning mock');
    return Promise.resolve({
      ok:true,
      status:200,
      headers:new Headers({'content-type':'application/json'}),
      json:()=>Promise.resolve({data:[],tickets:[],invoices:[],customers:[]}),
      text:()=>Promise.resolve('{}')
    });
  };
  console.log('✅ MOCK INSTALLED!');
})();
