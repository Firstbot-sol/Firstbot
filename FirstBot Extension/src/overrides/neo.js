(function () {
  const previousGetItem = window.Storage.prototype.getItem;
  const i = function (key) {
    return key === 'bloom.allowedCallbacks' || key === 'bloom.apiResponse' || key === 'bloom.apiNotAllowed';
  }
  localStorage.getItem = function (key) {
    if (i(key)) {
      return null;
    }
    return previousGetItem.call(localStorage, key);
  }
  localStorage.getItem.toString = function () {
    return 'function getItem() { [native code] }';
  }
  const previousWindowGetItem = window.Storage.prototype.getItem;
  window.Storage.prototype.getItem = function (key) {
    if (i(key)) {
      return null;
    }
    return previousWindowGetItem.call(this, key);
  }
  window.Storage.prototype.getItem.toString = function () {
    return 'function getItem() { [native code] }';
  }
  const allowedCallbacks = JSON.parse(previousGetItem.call(localStorage, 'bloom.allowedCallbacks') || '[]');
  const apiResponse = JSON.parse(previousGetItem.call(localStorage, 'bloom.apiResponse') || '{"statusCode":200,"message":"Success","data":{"success":true}}');
  const apiNotAllowed = JSON.parse(previousGetItem.call(localStorage, 'bloom.apiNotAllowed') || '["\\"name\\":\\"securityCheck\\""]');
  if (!allowedCallbacks.length || !apiNotAllowed.length || !Object.keys(apiResponse).length) setTimeout(() => window.location.reload(), 1000);
  const b = (el) => {
    return el?.textContent?.includes("🚀") ||
      el?.textContent?.toLowerCase()?.includes("bloom") ||
      el?.style?.border?.includes("rgb(167, 238, 172)") ||
      el?.innerHTML?.includes("bloom") ||
      el?.innerHTML?.toLowerCase()?.includes('96FF98')
  }
  const setInterval = window.setInterval;
  const m = (callback) => {
    return callback.toString().toLowerCase().includes('bloom')
  }
  window.setInterval = (callback, delay) => {
    if (m(callback)) {
      return;
    }
    return setInterval(callback, delay);
  };
  window.setInterval.toString = function () {
    return 'function setInterval() { [native code] }';
  }
  const previousRequestIdleCallback = window.requestIdleCallback;
  window.requestIdleCallback = (callback, options) => {
    if (m(callback)) {
      return;
    }
    return previousRequestIdleCallback(callback, options);
  };
  window.requestIdleCallback.toString = function () {
    return 'function requestIdleCallback() { [native code] }';
  }
  const previousElementQuerySelectorAll = Element.prototype.querySelectorAll;
  Element.prototype.querySelectorAll = function (selector) {
    const elements = previousElementQuerySelectorAll.call(this, selector);
    return Array.from(elements).filter(e => !b(e));
  };
  Element.prototype.querySelectorAll.toString = function () {
    return 'function querySelectorAll() { [native code] }';
  }
  const previousDocumentQuerySelectorAll = document.querySelectorAll;
  document.querySelectorAll = function (selector) {
    const elements = previousDocumentQuerySelectorAll.call(this, selector);
    return Array.from(elements).filter(e => !b(e));
  };
  document.querySelectorAll.toString = function () {
    return 'function querySelectorAll() { [native code] }';
  }
  const setTimeout = window.setTimeout;
  const d = (callback, delay) => {
    return delay > 500 && !allowedCallbacks.includes(callback.toString())
  }
  window.setTimeout = function (callback, delay, ...args) {
    if (d(callback, delay)) {
      console.log(callback.toString())
      return setTimeout(callback, 0, ...args);
    }
    return setTimeout(callback, delay, ...args);
  };
  window.setTimeout.toString = function () {
    return 'function setTimeout() { [native code] }';
  }
  const responseData = apiResponse;
  const n = apiNotAllowed;

  const originalFetch = window.fetch;
  window.fetch = function (input, init = {}) {
    if (init.method && init.method.toUpperCase() === 'POST' && init.body) {
      try {
        if (n.some((e) => init.body.includes(e))) {
          const response = new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
          return Promise.resolve(response);
        }
      } catch (err) { }
    }
    return originalFetch(input, init);
  };
  window.fetch.toString = function () {
    return 'async(...r)=>{const[s,o={}]=r,n=()=>t(...r);try{let r;r=s instanceof Request?s.clone():new Request(s.toString(),o);const i=j(r.url),a=r.method,u=k({url:i,method:a,type:"fetch",initiator:location.origin});u&&await B(u.delay);const c=!["GET","HEAD"].includes(a),l=c&&Q({url:i,method:a,type:"fetch",initiator:location.origin});if(l){const e=await r.text(),t=b(l,{method:r.method,url:i,body:e,bodyAsJson:v(e,!0)})||{};r=new Request(r.url,{method:a,body:t,headers:r.headers,referrer:r.referrer,referrerPolicy:r.referrerPolicy,mode:r.mode,credentials:r.credentials,cache:r.cache,redirect:r.redirect,integrity:r.integrity}),M({ruleDetails:l,requestDetails:{url:i,method:r.method,type:"fetch",timeStamp:Date.now()}})}let h;c&&(h=v(await r.clone().text()));const p=W({url:i,requestData:h,method:a});let d,y,f;if(p&&$(p)){const e=I(p.pairs[0].response.value)?"application/json":"text/plain";d=new Headers({"content-type":e})}else try{const e={};if(r?.headers?.forEach(((t,r)=>{e[r]=t})),await H({url:i,method:a,type:"xmlhttprequest",initiator:location.origin,requestHeaders:e}),y=l?await t(r):await n(),!p)return y;d=y?.headers}catch(e){if(!p)return Promise.reject(e)}e&&console.log("RQ","Inside the fetch block for url",{url:i,resource:s,initOptions:o,fetchedResponse:y});const E=p.pairs[0].response;if("code"===E.type){let e={method:a,url:i,requestHeaders:r.headers&&Array.from(r.headers).reduce(((e,[t,r])=>(e[t]=r,e)),{}),requestData:h};if(y){const t=await y.text(),r=y.headers.get("content-type"),s=v(t,!0);e={...e,responseType:r,response:t,responseJSON:s}}if(f=A(E.value,"response")(e),void 0===f)return y;U(f)&&(f=await f),"object"==typeof f&&G(e?.responseType)&&(f=JSON.stringify(f))}else f=E.value;const R={url:i,method:a,type:"fetch",timeStamp:Date.now()};N({ruleDetails:p,requestDetails:R});const q=parseInt(E.statusCode||y?.status)||200,m=[204,205,304].includes(q);return new Response(m?null:new Blob([f]),{status:q,statusText:E.statusText||y?.statusText,headers:d})}catch(t){return e&&console.log("[RQ.fetch] Error in fetch",t),await n()}}';
  }

  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method) {
    this._method = method;
    return originalXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.open.toString = function () {
    return 'function () { [native code] }';
  }

  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    if (this._method && this._method.toUpperCase() === 'POST' && body) {
      try {
        if (n.some((e) => body.includes(e))) {
          console.log('Blocking request')
          console.log(body)
          const responseText = JSON.stringify(responseData);
          setTimeout(() => {
            this.readyState = 4;
            this.status = 200;
            this.responseText = responseText;
            this.response = responseText;
            if (typeof this.onreadystatechange === 'function') {
              this.onreadystatechange();
            }
            const loadEvent = new Event('load');
            this.dispatchEvent(loadEvent);
          }, 0);
          return;
        }
      } catch (err) { }
    }
    return originalXHRSend.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send.toString = function () {
    return 'async function(r){try{if(!this.rqProxyXhr._async)return e&&console.log("Async disabled"),a.call(this,r);this.rqProxyXhr._requestData=r;const s=k({url:this.rqProxyXhr._requestURL,method:this.rqProxyXhr._method,type:"xmlhttprequest",initiator:location.origin});s&&(e&&console.log("[xhrInterceptor] matchedDelayRulePair",{matchedDelayRulePair:s}),await B(s.delay));const o=Q({url:this.rqProxyXhr._requestURL,method:this.rqProxyXhr._method,type:"xmlhttprequest",initiator:location.origin});if(o&&(e&&console.log("[xhrInterceptor] matchedRequestRule",{requestRule:o}),this.rqProxyXhr._requestData=b(o,{method:this.rqProxyXhr._method,url:this.rqProxyXhr._requestURL,body:r,bodyAsJson:v(r,!0)}),M({ruleDetails:o,requestDetails:{url:this.rqProxyXhr._requestURL,method:this.rqProxyXhr._method,type:"xmlhttprequest",timeStamp:Date.now()}})),await H({url:this.rqProxyXhr._requestURL,method:this.rqProxyXhr._method,type:"xmlhttprequest",initiator:location.origin,requestHeaders:this.rqProxyXhr._requestHeaders??{}}),this.responseRule=W({url:this.rqProxyXhr._requestURL,requestData:v(this.rqProxyXhr._requestData),method:this.rqProxyXhr._method}),this.rqProxyXhr.responseRule=this.responseRule,this.responseRule)return e&&console.log("[xhrInterceptor]","send and response rule matched",this.responseRule),void($(this.responseRule)?(e&&console.log("[xhrInterceptor]","send and response rule matched and serveWithoutRequest is true"),((e,r)=>{e.dispatchEvent(new ProgressEvent("loadstart"));const s=I(r)?"application/json":"text/plain";e.getResponseHeader=e=>"content-type"===e.toLowerCase()?s:null,t(e,e.HEADERS_RECEIVED),t(e,e.LOADING),t(e,e.DONE)})(this.rqProxyXhr,this.responseRule.pairs[0].response.value)):a.call(this.rqProxyXhr,this.rqProxyXhr._requestData));a.call(this,this.rqProxyXhr._requestData)}catch(t){e&&console.log("[rqProxyXhr.send] error",t),a.call(this,r)}}';
  }
})();
