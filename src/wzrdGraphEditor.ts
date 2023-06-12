import * as vscode from "vscode";
import {CancellationToken, TextDocument, WebviewPanel} from "vscode";
import {randomUUID} from "crypto";
import {getNonce} from "./util";


export class WzrdGraphEditorProvider implements vscode.CustomTextEditorProvider {

  private static readonly viewType = "wzrd.editor";

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new WzrdGraphEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(WzrdGraphEditorProvider.viewType, provider);
  }

  constructor(private readonly context: vscode.ExtensionContext) {
  }

  resolveCustomTextEditor(document: TextDocument, webviewPanel: WebviewPanel, token: CancellationToken): Thenable<void> | void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "lib")
      ]
    }

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document.getText());

    webviewPanel.webview.onDidReceiveMessage(e => {
      switch (e.type) {
        case 'updateDocument':
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), e.data);
          vscode.workspace.applyEdit(edit);
          return;
      }
    })

  }

  private getHtmlForWebview(webview: vscode.Webview, fileContents: string): string {
    const swUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "dist", "lib", "sw.js"))
    const wasmUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "dist", "lib", "graph_editor_bg.wasm"))
    const wasmJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "dist", "lib", "graph_editor.js"))

    const nonce = getNonce();

    const fileContentFunction = `
    function getFileContents(){
      return \`${fileContents}\`
    }
    `

    return /* html*/`
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">

  <!-- Disable zooming: -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">


  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}' 'unsafe-eval'; connect-src https:; script-src-elem 'nonce-${nonce}' https:;">
  <!-- change this to your project name -->
  <title>Wzrd Graph Editor</title>

  <!-- config for our rust wasm binary. go to https://trunkrs.dev/assets/#rust for more customization -->
  <script nonce="${nonce}" type="importmap">
    {
      "imports": {
        "wasmJs": "${wasmJsUri}"
      }
    }
  </script>
  <script nonce="${nonce}" type="module">
    import init from "wasmJs";

    init('${wasmUri}');
  </script>
  <!--
  <script type="module" nonce="${nonce}">
    import init from "${wasmJsUri}";

    init('${wasmUri}');
  </script>
  -->
  <!-- this is the base url relative to which other urls will be constructed. trunk will insert this from the public-url option -->
  <base href="/">

  <!--    <link data-trunk rel="icon" href="assets/favicon.ico">-->


  <!--    <link data-trunk rel="copy-file" href="assets/manifest.json" />-->
  <!--    <link data-trunk rel="copy-file" href="assets/icon-1024.png" />-->
  <!--    <link data-trunk rel="copy-file" href="assets/icon-256.png" />-->
  <!--    <link data-trunk rel="copy-file" href="assets/icon_ios_touch_192.png" />-->
  <!--    <link data-trunk rel="copy-file" href="assets/maskable_icon_x512.png" />-->


  <!--    <link rel="manifest" href="manifest.json">-->
  <!--    <link rel="apple-touch-icon" href="icon_ios_touch_192.png">-->
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="white">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#404040">

  <style nonce="${nonce}">
    html {
      /* Remove touch delay: */
      touch-action: manipulation;
    }

    body {
      /* Light mode background color for what is not covered by the egui canvas,
      or where the egui canvas is translucent. */
      background: #909090;
    }

    @media (prefers-color-scheme: dark) {
      body {
        /* Dark mode background color for what is not covered by the egui canvas,
        or where the egui canvas is translucent. */
        background: #404040;
      }
    }

    /* Allow canvas to fill entire web page: */
    html,
    body {
      overflow: hidden;
      margin: 0 !important;
      padding: 0 !important;
      height: 100%;
      width: 100%;
    }

    /* Position canvas in center-top: */
    canvas {
      margin-right: auto;
      margin-left: auto;
      display: block;
      position: absolute;
      top: 0%;
      left: 50%;
      transform: translate(-50%, 0%);
    }

    .centered {
      margin-right: auto;
      margin-left: auto;
      display: block;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #f0f0f0;
      font-size: 24px;
      font-family: Ubuntu-Light, Helvetica, sans-serif;
      text-align: center;
    }

    /* ---------------------------------------------- */
    /* Loading animation from https://loading.io/css/ */
    .lds-dual-ring {
      display: inline-block;
      width: 24px;
      height: 24px;
    }

    .lds-dual-ring:after {
      content: " ";
      display: block;
      width: 24px;
      height: 24px;
      margin: 0px;
      border-radius: 50%;
      border: 3px solid #fff;
      border-color: #fff transparent #fff transparent;
      animation: lds-dual-ring 1.2s linear infinite;
    }

    @keyframes lds-dual-ring {
      0% {
        transform: rotate(0deg);
      }

      100% {
        transform: rotate(360deg);
      }
    }

  </style>

  <link rel="preload" href="${wasmUri}" as="fetch" type="application/wasm" crossorigin="">
  <link rel="modulepreload" href="${wasmJsUri}">
</head>

<body>
<!-- The WASM code will resize the canvas dynamically -->
<!-- the id is hardcoded in main.rs . so, make sure both match. -->
<canvas id="WzrdGraphEditor"></canvas>

<!--Register Service Worker. this will cache the wasm / js scripts for offline use (for PWA functionality). -->
<!-- Force refresh (Ctrl + F5) to load the latest files instead of cached files  -->
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  function updateDocument(str) {
    vscode.postMessage({
      type: 'updateDocument',
      data: str
    });
  }
  
  ${fileContentFunction}

  // We disable caching during development so that we always view the latest version.
  if ('serviceWorker' in navigator && window.location.hash !== "#dev") {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('${swUri}');
    });
  }
</script>


<!--<script>(function () {-->
<!--    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';-->
<!--    var url = protocol + '//' + window.location.host + '/_trunk/ws';-->
<!--    var poll_interval = 5000;-->
<!--    var reload_upon_connect = () => {-->
<!--        window.setTimeout(-->
<!--            () => {-->
<!--                // when we successfully reconnect, we'll force a-->
<!--                // reload (since we presumably lost connection to-->
<!--                // trunk due to it being killed, so it will have-->
<!--                // rebuilt on restart)-->
<!--                var ws = new WebSocket(url);-->
<!--                ws.onopen = () => window.location.reload();-->
<!--                ws.onclose = reload_upon_connect;-->
<!--            },-->
<!--            poll_interval);-->
<!--    };-->

<!--    var ws = new WebSocket(url);-->
<!--    ws.onmessage = (ev) => {-->
<!--        const msg = JSON.parse(ev.data);-->
<!--        if (msg.reload) {-->
<!--            window.location.reload();-->
<!--        }-->
<!--    };-->
<!--    ws.onclose = reload_upon_connect;-->
<!--})()-->
<!--</script>-->
</body>
</html><!-- Powered by egui: https://github.com/emilk/egui/ -->

    `;
  }

}
