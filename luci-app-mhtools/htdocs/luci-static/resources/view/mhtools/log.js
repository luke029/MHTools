'use strict';
'require view';
'require uci';
'require poll';
'require ui';
'require tools.mhtools as dp';

var CSS = [
	'.ms-wrap{padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI","PingFang SC",sans-serif;color:#1d1d1f}',
	'.ms-log-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}',
	'.ms-log-title{font-size:19px;font-weight:700;letter-spacing:-.02em}',
	'.ms-log-tools{display:flex;align-items:center;gap:12px}',
	'.ms-log-lines{display:flex;align-items:center;gap:6px;font-size:13px;color:#6e6e73}',
	'.ms-log-lines select{padding:5px 12px;font-size:13px;border:1px solid rgba(0,0,0,.1);border-radius:980px;background:rgba(255,255,255,.8);color:#1d1d1f;cursor:pointer;outline:none}',
	'.ms-log-lines select:focus{border-color:#007aff}',
	'.ms-btn{padding:6px 16px;border:1px solid rgba(0,0,0,.1);border-radius:980px;font-size:13px;font-weight:500;cursor:pointer;background:rgba(255,255,255,.8);color:#1d1d1f;transition:all .15s ease}',
	'.ms-btn:hover{background:rgba(0,122,255,.08);border-color:rgba(0,122,255,.2);color:#007aff}',
	'.ms-btn.danger{color:#ff453a;border-color:rgba(255,69,58,.2)}',
	'.ms-btn.danger:hover{background:rgba(255,69,58,.08);border-color:rgba(255,69,58,.3);color:#ff453a}',
	'.ms-auto-refresh{display:flex;align-items:center;gap:6px;font-size:13px;color:#6e6e73;cursor:pointer}',
	'.ms-auto-refresh input{cursor:pointer}',
	'.ms-log-section{margin-bottom:16px}',
	'.ms-log-section-title{font-size:15px;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px}',
	'.ms-log-box{border-radius:16px;overflow:hidden;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.05);border:1px solid rgba(0,0,0,.06)}',
	'.ms-log-box pre{margin:0;padding:20px 24px;font-size:12px;line-height:1.6;color:#1d1d1f;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;min-height:200px;max-height:40vh;overflow:auto;white-space:pre-wrap;word-break:break-all}',
	'.ms-log-empty{text-align:center;padding:60px 20px;color:#86868b;font-size:14px}',
	'body.dark .ms-log-box,body[data-theme="dark"] .ms-log-box{background:rgba(30,30,32,.72);border-color:rgba(255,255,255,.06)}',
	'body.dark .ms-log-box pre,body[data-theme="dark"] .ms-log-box pre{color:#f5f5f7}',
	'body.dark .ms-btn,body[data-theme="dark"] .ms-btn{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1);color:#f5f5f7}',
	'body.dark .ms-log-lines select,body[data-theme="dark"] .ms-log-lines select{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1);color:#f5f5f7}',
	'@media(max-width:640px){.ms-log-head{flex-direction:column;align-items:flex-start;gap:12px}.ms-log-tools{flex-wrap:wrap}.ms-log-box pre{max-height:30vh}}'
].join('');

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('mhtools'),
			dp.status()
		]);
	},

	render: function (data) {
		var lineCount = 300;
		var autoRefresh = true;
		var logSizeLimit = uci.get('mhtools', 'core', 'log_size_limit') || '300';

		var appLogPre = E('pre', { id: 'ms-app-log-content' }, '加载中...');
		var kernelLogPre = E('pre', { id: 'ms-kernel-log-content' }, '');

		function renderLogContent(text, pre) {
			if (!text || text.trim() === '') {
				pre.textContent = '（暂无日志）';
			} else {
				pre.textContent = text;
				pre.scrollTop = pre.scrollHeight;
			}
		}

		function loadLog() {
			dp.getAllLogs(300).then(function (r) {
				if (r) {
					renderLogContent(r.app_log, appLogPre);
					renderLogContent(r.kernel_log, kernelLogPre);
				}
			}).catch(function () {
				appLogPre.textContent = '（加载日志失败）';
				kernelLogPre.textContent = '（加载日志失败）';
			});
		}

		function clearLog() {
			dp.clearLogs().then(function (r) {
				if (r && r.success) {
					loadLog();
				} else {
					alert('清空日志失败：' + ((r && r.error) || '未知错误'));
				}
			}).catch(function (e) {
				alert('清空日志失败：' + (e && e.message ? e.message : '未知错误'));
			});
		}

		function downloadLog() {
			dp.getAllLogs(5000).then(function (r) {
				var text = '';
				if (r) {
					if (r.app_log) text += '===== 应用日志 =====\n' + r.app_log + '\n\n';
					if (r.kernel_log) text += '===== 内核日志 =====\n' + r.kernel_log;
				}
				if (!text) text = '（暂无日志）';
				var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
				var a = document.createElement('a');
				a.href = URL.createObjectURL(blob);
				a.download = 'mhtools-log-' + new Date().toISOString().slice(0, 10) + '.txt';
				a.style.display = 'none';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(a.href);
			}).catch(function () {
				alert('下载日志失败');
			});
		}

		poll.add(function () {
			loadLog();
		});

		loadLog();

		var pageEl = E('div', { 'class': 'ms-wrap' }, [
			E('style', CSS),
			E('div', { 'class': 'ms-log-head' }, [
				E('div', { 'class': 'ms-log-title' }, '系统日志'),
				E('div', { 'class': 'ms-log-tools' }, [
					E('button', {
						'class': 'ms-btn',
						click: function () { downloadLog(); }
					}, '下载日志'),
					E('button', {
						'class': 'ms-btn danger',
						click: function () { clearLog(); }
					}, '清空日志')
				])
			]),
			E('div', { 'class': 'ms-log-section' }, [
				E('div', { 'class': 'ms-log-section-title' }, [
					E('span', { style: 'width:6px;height:6px;border-radius:50%;background:#34c759;display:inline-block' }),
					'应用日志'
				]),
				E('div', { 'class': 'ms-log-box' }, appLogPre)
			]),
			E('div', { 'class': 'ms-log-section' }, [
				E('div', { 'class': 'ms-log-section-title' }, [
					E('span', { style: 'width:6px;height:6px;border-radius:50%;background:#007aff;display:inline-block' }),
					'内核日志'
				]),
				E('div', { 'class': 'ms-log-box' }, kernelLogPre)
			])
		]);

		return pageEl;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
