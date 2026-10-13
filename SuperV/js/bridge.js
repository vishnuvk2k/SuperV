/* Load the AE host explicitly, then serialize commands through one connection. */
(function (root) {
  'use strict';
  var VERSION = '1.3.2';
  function literal(value) {
    return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }
  function hostScript(extensionRoot, action, args, initialize) {
    var file = extensionRoot.replace(/\\/g, '/').replace(/\/$/, '') + '/jsx/host.jsx';
    return '(function(){var r;try{' +
      (initialize ?
        'var f=new File(' + literal(file) + ');' +
        'if(!f.exists)throw new Error("Host script is missing: "+f.fsName);' +
        'if(!$.global.__VK_GSD_HOST__||$.global.__VK_GSD_HOST__.version!==' + literal(VERSION) +
        '||$.global.__VK_GSD_HOST__.source!==f.fsName){$.evalFile(f);}' : '') +
      'var h=$.global.__VK_GSD_HOST__;' +
      'if(!h||h.version!==' + literal(VERSION) + ')throw new Error("VK host is not loaded. Use SETTINGS > RECONNECT.");' +
      'r=h.dispatch(' + literal(action) + ',' + literal(encodeURIComponent(JSON.stringify(args || {}))) + ');' +
      'if(typeof r!=="string"||!r.length)throw new Error("The VK host returned no result.");' +
      'return "VK_RESULT:"+encodeURIComponent(r);' +
      '}catch(e){return "VK_ERROR:"+encodeURIComponent(String(e.message||e)+(e.line?" (line "+e.line+")":""));}})()';
  }
  function create(cep, extensionRoot) {
    var ready = null, connected = false, tail = Promise.resolve();
    function evaluate(script, action) {
      return new Promise(function (resolve, reject) {
        if (!cep) return reject(new Error('Open this extension inside After Effects to run tools.'));
        try {
          cep.evalScript(script, function (raw) {
            var text = raw === null || raw === undefined ? '' : String(raw), result;
            try {
              if (text.indexOf('VK_ERROR:') === 0) throw new Error(decodeURIComponent(text.slice(9)));
              if (text.indexOf('VK_RESULT:') !== 0) {
                connected = false; ready = null;
                throw new Error('AE connection failed during '+action+'. '+
                  (text ? 'Response: '+text.slice(0,180)+'. ' : 'No script result received. ')+
                  'Use SETTINGS > RECONNECT. This command was not retried.');
              }
              result = JSON.parse(decodeURIComponent(text.slice(10)));
              if (!result || typeof result.ok !== 'boolean') throw new Error('Invalid VK host response for '+action+'.');
            } catch (e) { reject(e); return; }
            if (!result.ok) { reject(new Error(result.message || 'After Effects rejected '+action+'.')); return; }
            resolve(result);
          });
        } catch (e) { reject(e); }
      });
    }
    function connect() {
      if (!ready) {
        ready = evaluate(hostScript(extensionRoot, 'ping', {}, true), 'connection check').then(function (r) {
          connected = true; return r;
        }, function (e) { ready = null; connected = false; throw e; });
      }
      return ready;
    }
    function queue(fn) {
      var task = tail.then(fn); tail = task.catch(function () {}); return task;
    }
    return {
      call: function (action, args) {
        return queue(function () { return connect().then(function (ping) {
          if (action === 'ping') return ping;
          return evaluate(hostScript(extensionRoot, action, args, false), action);
        }); });
      },
      reconnect: function () {
        return queue(function () { ready = null; connected = false; return connect(); });
      },
      isConnected: function () { return connected; }
    };
  }
  root.VKBridge = { create: create, hostScript: hostScript, version: VERSION };
})(typeof window !== 'undefined' ? window : module.exports);
