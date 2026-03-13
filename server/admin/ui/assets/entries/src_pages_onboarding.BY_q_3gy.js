import{r as i,d as k,e as T,n as C,j as e,i as N,a as A,b as P,o as E}from"../chunks/chunk-B-uZaRcZ.js";import{I as U}from"../chunks/chunk-DcGWDHgl.js";import{B as S}from"../chunks/chunk-n4yRLdiF.js";import"../chunks/chunk-B4v4Ae5Q.js";/* empty css                      *//* empty css                      */function D(){const[r,o]=i.useState(""),[l,n]=i.useState(""),[t,p]=i.useState(null),[a,m]=i.useState(!1),[h,f]=i.useState(!1),{showToast:c}=k(),g=i.useCallback(async()=>{if(!r.trim())return c("Error","Username is required","error"),!1;if(!l.trim())return c("Error","Realm name is required","error"),!1;m(!0);try{const v=await T.createAdmin({username:r.trim(),realm_name:l.trim(),create_sysadmin:!0,create_realm:!0});return p(v),!0}catch{return c("Error","Failed to create admin account","error"),!1}finally{m(!1)}},[r,l,c]),b=i.useCallback(async()=>{t?.pat&&(await navigator.clipboard.writeText(t.pat),f(!0),c("Copied!","PAT copied to clipboard","success"),setTimeout(()=>f(!1),2e3))},[t,c]),d=i.useCallback(()=>{C("/dashboard")},[]),s=["var(--color-red)","var(--color-blue)","var(--color-green)","var(--color-purple)"],u=[{title:"Admin Account",content:e.jsxs(y,{color:"var(--color-red)",children:[e.jsx(w,{color:"var(--color-red)",children:"Create Your Admin Account"}),e.jsx(j,{children:"This will be your primary administrator account for managing Bifrost."}),e.jsx(z,{label:"Username",value:r,onChange:o,placeholder:"Enter your username",disabled:a})]})},{title:"Create Realm",content:e.jsxs(y,{color:"var(--color-blue)",children:[e.jsx(w,{color:"var(--color-blue)",children:"Create Your First Realm"}),e.jsx(j,{children:"A realm is an isolated workspace for managing runes (issues, tasks, bugs)."}),e.jsx(z,{label:"Realm Name",value:l,onChange:n,placeholder:"e.g., my-project",disabled:a})]})},{title:"Access Token",content:e.jsxs(y,{color:"var(--color-green)",children:[e.jsx(w,{color:"var(--color-green)",children:"Your Personal Access Token"}),e.jsx(j,{children:"Save this token securely. You'll need it to authenticate with Bifrost."}),t?e.jsx(B,{pat:t.pat,copied:h,onCopy:b}):e.jsx("div",{className:"text-center py-8",children:e.jsx("p",{className:"text-sm opacity-60",children:"Click Next to generate your token..."})})]})},{title:"Complete",content:e.jsxs(y,{color:"var(--color-purple)",children:[e.jsx(w,{color:"var(--color-purple)",children:"You're All Set!"}),e.jsx(j,{children:"Your Bifrost instance is ready to use. Start creating and managing runes."}),e.jsx("div",{className:"text-center py-8",children:e.jsxs("div",{className:"inline-block px-6 py-4 text-sm",style:{border:"2px solid var(--color-purple)",boxShadow:"var(--shadow-soft)"},children:[e.jsx("p",{className:"font-bold mb-2",children:"Setup Summary"}),e.jsxs("p",{children:["Admin: ",e.jsx("strong",{children:r})]}),e.jsxs("p",{children:["Realm: ",e.jsx("strong",{children:l})]})]})})]})}],x=i.useCallback(async v=>v===2&&!t?g():!0,[t,g]);return e.jsx("div",{className:"min-h-[calc(100vh-56px)] flex items-center justify-center p-6",children:e.jsxs("div",{className:"w-full max-w-2xl",children:[e.jsxs("div",{className:"mb-8 text-center",children:[e.jsx("h1",{className:"text-4xl font-bold tracking-tight mb-2",children:e.jsx("span",{className:"bifrost-logo-text",children:"Bifrost"})}),e.jsx("p",{className:"text-sm uppercase tracking-widest",style:{color:"var(--color-border)"},children:"First-Time Setup"})]}),e.jsx("div",{className:"p-8",style:{backgroundColor:"var(--color-bg)",border:"2px solid var(--color-border)",boxShadow:"var(--shadow-soft)"},children:e.jsx(R,{steps:u,colors:s,onComplete:d,onValidateStep:x})})]})})}function R({steps:r,colors:o,onComplete:l,onValidateStep:n}){const[t,p]=i.useState(0),[a,m]=i.useState(!1),h=t===r.length-1,f=t===0,c=async()=>{if(!a){m(!0);try{await n(t)&&(h?l():p(s=>s+1))}finally{m(!1)}}},g=()=>{f||p(d=>d-1)},b=d=>o[d%o.length]??o[0];return e.jsxs("div",{className:"wizard",children:[e.jsx("div",{className:"wizard-indicators",children:r.map((d,s)=>{const u=s===t,x=s<t,v=s>t;return e.jsxs("div",{className:"wizard-step-indicator",children:[e.jsx("div",{className:"step-number",style:{backgroundColor:u||x?b(s):"#f5f5f5",borderColor:u||x?b(s):"#000000",color:u||x?"#ffffff":"#000000"},children:x?"✓":s+1}),e.jsx("div",{className:"step-title",style:{color:u?b(s):v?"#999999":"#000000",fontWeight:u?"bold":"normal"},children:d.title}),s<r.length-1&&e.jsx("div",{className:"step-connector"})]},d.title)})}),e.jsx("div",{className:"wizard-content",children:r[t]?.content}),e.jsxs("div",{className:"wizard-navigation",children:[!f&&e.jsx(S,{onClick:g,className:"wizard-button wizard-button-back",type:"button",children:"← Back"}),e.jsx(S,{onClick:c,className:`wizard-button ${h?"wizard-button-done":"wizard-button-next"}`,type:"button",disabled:a,children:a?"Processing...":h?"Go to Dashboard →":"Next →"})]}),e.jsx("style",{children:`
        .wizard {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .wizard-indicators {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 16px;
          border: 2px solid var(--color-border);
          background: var(--color-bg);
          box-shadow: 4px 4px 0px var(--color-border);
        }

        .wizard-step-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          position: relative;
          flex: 1;
        }

        .step-number {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid;
          border-radius: 0;
          font-weight: bold;
          font-size: 16px;
          box-shadow: 2px 2px 0px var(--color-border);
          transition: all 0.2s;
        }

        .step-number:hover {
          transform: translate(-2px, -2px);
          box-shadow: 4px 4px 0px var(--color-border);
        }

        .step-title {
          font-size: 12px;
          text-align: center;
          max-width: 100px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .step-connector {
          position: absolute;
          top: 36px;
          left: 50%;
          width: 100%;
          height: 2px;
          background: var(--color-border);
          z-index: -1;
        }

        .wizard-step-indicator:last-child .step-connector {
          display: none;
        }

        .wizard-content {
          padding: 24px;
          border: 2px solid var(--color-border);
          background: var(--color-bg);
          box-shadow: 4px 4px 0px var(--color-border);
          min-height: 200px;
        }

        .wizard-navigation {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .wizard-button {
          padding: 12px 24px;
          border: 2px solid var(--color-border);
          border-radius: 0;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          background: var(--color-bg);
          box-shadow: 4px 4px 0px var(--color-border);
          transition: all 0.1s;
          color: var(--color-text);
        }

        .wizard-button:hover:not(:disabled) {
          transform: translate(-2px, -2px);
          box-shadow: 6px 6px 0px var(--color-border);
        }

        .wizard-button:active:not(:disabled) {
          transform: translate(2px, 2px);
          box-shadow: 0px 0px 0px var(--color-border);
        }

        .wizard-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .wizard-button-back {
          background: #f5f5f5;
          color: #000000;
        }

        .wizard-button-next {
          background: var(--color-bg);
        }

        .wizard-button-done {
          background: var(--color-green);
          color: #ffffff;
          border-color: #000000;
        }

        .wizard-button-done:hover:not(:disabled) {
          background: #16a34a;
        }
      `})]})}function y({children:r}){return e.jsx("div",{className:"step-content",children:r})}function w({children:r,color:o}){return e.jsx("h2",{className:"text-xl font-bold mb-4 uppercase tracking-wide",style:{color:o},children:r})}function j({children:r}){return e.jsx("p",{className:"text-sm mb-6 opacity-70",style:{color:"var(--color-text)"},children:r})}function z({label:r,value:o,onChange:l,placeholder:n,disabled:t}){const p=r.toLowerCase().replace(/\s+/g,"-");return e.jsxs("div",{className:"mb-6",children:[e.jsx("label",{htmlFor:p,className:"block text-xs uppercase tracking-wider mb-2 font-semibold",style:{color:"var(--color-border)"},children:r}),e.jsx(U,{id:p,type:"text",value:o,onChange:a=>l(a.target.value),placeholder:n,disabled:t,className:"w-full px-4 py-3 text-sm transition-all duration-150",style:{backgroundColor:"var(--color-bg)",border:"2px solid var(--color-border)",color:"var(--color-text)",boxShadow:"var(--shadow-soft)"},onFocus:a=>{a.currentTarget.style.boxShadow="var(--shadow-soft-hover)",a.currentTarget.style.transform="translate(2px, 2px)"},onBlur:a=>{a.currentTarget.style.boxShadow="var(--shadow-soft)",a.currentTarget.style.transform="translate(0, 0)"}})]})}function B({pat:r,copied:o,onCopy:l}){return e.jsxs("div",{className:"space-y-4",children:[e.jsx("div",{className:"p-4 font-mono text-sm break-all",style:{backgroundColor:"var(--color-bg)",border:"2px solid var(--color-green)",boxShadow:"var(--shadow-soft)"},children:r}),e.jsx(S,{onClick:l,className:"w-full py-3 px-6 text-sm font-bold uppercase tracking-wider transition-all duration-150",style:{backgroundColor:o?"var(--color-green)":"var(--color-bg)",border:"2px solid var(--color-border)",color:o?"#ffffff":"var(--color-text)",boxShadow:"var(--shadow-soft)"},onMouseEnter:n=>{o||(n.currentTarget.style.boxShadow="var(--shadow-soft-hover)",n.currentTarget.style.transform="translate(2px, 2px)")},onMouseLeave:n=>{n.currentTarget.style.boxShadow="var(--shadow-soft)",n.currentTarget.style.transform="translate(0, 0)"},children:o?"✓ Copied!":"Copy to Clipboard"}),e.jsx("p",{className:"text-xs text-center opacity-60",style:{color:"var(--color-text)"},children:"⚠️ Store this token securely. It won't be shown again."})]})}const _=Object.freeze(Object.defineProperty({__proto__:null,Page:D},Symbol.toStringTag,{value:"Module"})),M={hasServerOnlyHook:{type:"computed",definedAtData:null,valueSerialized:{type:"js-serialized",value:!1}},isClientRuntimeLoaded:{type:"computed",definedAtData:null,valueSerialized:{type:"js-serialized",value:!0}},onBeforeRenderEnv:{type:"computed",definedAtData:null,valueSerialized:{type:"js-serialized",value:null}},dataEnv:{type:"computed",definedAtData:null,valueSerialized:{type:"js-serialized",value:null}},guardEnv:{type:"computed",definedAtData:null,valueSerialized:{type:"js-serialized",value:null}},onRenderClient:{type:"standard",definedAtData:{filePathToShowToUser:"vike-react/__internal/integration/onRenderClient",fileExportPathToShowToUser:[]},valueSerialized:{type:"pointer-import",value:E}},Page:{type:"standard",definedAtData:{filePathToShowToUser:"/src/pages/onboarding/+Page.tsx",fileExportPathToShowToUser:[]},valueSerialized:{type:"plus-file",exportValues:_}},hydrationCanBeAborted:{type:"standard",definedAtData:{filePathToShowToUser:"vike-react/config",fileExportPathToShowToUser:["default","hydrationCanBeAborted"]},valueSerialized:{type:"js-serialized",value:!0}},Layout:{type:"cumulative",definedAtData:[{filePathToShowToUser:"/src/pages/+Layout.tsx",fileExportPathToShowToUser:[]}],valueSerialized:[{type:"plus-file",exportValues:P}]},Wrapper:{type:"cumulative",definedAtData:[{filePathToShowToUser:"/src/pages/+Wrapper.tsx",fileExportPathToShowToUser:[]}],valueSerialized:[{type:"plus-file",exportValues:A}]},Loading:{type:"standard",definedAtData:{filePathToShowToUser:"vike-react/__internal/integration/Loading",fileExportPathToShowToUser:[]},valueSerialized:{type:"pointer-import",value:N}}};export{M as configValuesSerialized};
