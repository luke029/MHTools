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
	'.ms-log-box{border-radius:16px;overflow:hidden;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.05);border:1px solid rgba(0,0,0,.06)}',
	'.ms-log-box pre{margin:0;padding:20px 24px;font-size:12px;line-height:1.6;color:#1d1d1f;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;height:calc(100vh - 160px);min-height:500px;overflow:auto;white-space:pre-wrap;word-break:break-all}',
	'.ms-log-empty{text-align:center;padding:60px 20px;color:#86868b;font-size:14px}',
	'body.dark .ms-log-box,body[data-theme="dark"] .ms-log-box{background:rgba(30,30,32,.72);border-color:rgba(255,255,255,.06)}',
	'body.dark .ms-log-box pre,body[data-theme="dark"] .ms-log-box pre{color:#f5f5f7}',
	'body.dark .ms-btn,body[data-theme="dark"] .ms-btn{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1);color:#f5f5f7}',
	'body.dark .ms-log-lines select,body[data-theme="dark"] .ms-log-lines select{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1);color:#f5f5f7}',
	'@media(max-width:640px){.ms-log-head{flex-direction:column;align-items:flex-start;gap:12px}.ms-log-tools{flex-wrap:wrap}.ms-log-box pre{height:50vh}}'
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

		var logPre = E('pre', { id: 'ms-log-content' }, '加载中...');

		var lineSelect = E('select', {
			change: function () {
				lineCount = parseInt(this.value);
				loadLog();
			}
		}, [
			E('option', { value: '100' }, '100 行'),
			E('option', { value: '300', selected: 'selected' }, '300 行'),
			E('option', { value: '500' }, '500 行'),
			E('option', { value: '1000' }, '1000 行'),
			E('option', { value: '2000' }, '2000 行')
		]);

		var autoRefreshCb = E('input', {
			type: 'checkbox',
			checked: 'checked',
			change: function () {
				autoRefresh = this.checked;
			}
		});

		var limitInput = E('input', {
			type: 'number',
			min: '10',
			max: '10240',
			value: logSizeLimit,
			style: 'width:56px;padding:3px 6px;font-size:12px;border:1px solid rgba(128,128,128,.2);border-radius:6px;text-align:center;'
		});

		function loadLog() {
			dp.getAllLogs(lineCount).then(function (r) {
				if (logPre && r) {
					var log = r.log || '';
					if (!log || log.trim() === '') {
						logPre.textContent = '（暂无日志，启动服务或操作后此处会显示日志）';
					} else {
						logPre.textContent = log;
						logPre.scrollTop = logPre.scrollHeight;
					}
				}
			}).catch(function () {
				logPre.textContent = '（加载日志失败）';
			});
		}

		function clearLog() {
			dp.clearLogs().then(function (r) {
				if (r && r.success) {
					ui.addNotification(null, E('p', '日志已清空'), 'info');
					loadLog();
				} else {
					ui.addNotification(null, E('p', '清空日志失败'), 'error');
				}
			}).catch(function () {
				ui.addNotification(null, E('p', '清空日志失败'), 'error');
			});
		}

		function saveLimit() {
			var val = limitInput.value || '300';
			uci.set('mhtools', 'core', 'log_size_limit', val);
			uci.apply().then(function () {
				ui.addNotification(null, E('p', '自动清理设置已保存（' + val + ' KB）'), 'info');
			});
		}

		poll.add(function () {
			if (autoRefresh) {
				loadLog();
			}
		});

		loadLog();

		var pageEl = E('div', { 'class': 'ms-wrap' }, [
			E('style', CSS),
			E('div', { 'class': 'ms-log-head' }, [
				E('div', { 'class': 'ms-log-title' }, '系统日志'),
				E('div', { 'class': 'ms-log-tools' }, [
					E('div', { 'class': 'ms-log-lines' }, [
						'显示',
						lineSelect
					]),
					E('button', {
						'class': 'ms-btn',
						click: function () { loadLog(); }
					}, '刷新'),
					E('button', {
						'class': 'ms-btn',
						click: function () { clearLog(); }
					}, '清空日志'),
					E('label', { 'class': 'ms-auto-refresh' }, [
						autoRefreshCb,
						'自动刷新'
					]),
					E('span', { style: 'font-size:13px;color:#6e6e73;display:flex;align-items:center;gap:4px;' }, [
						'超过',
						limitInput,
						'KB 清除',
						E('button', {
							'class': 'ms-btn',
							style: 'padding:4px 10px;font-size:11px;',
							click: function () { saveLimit(); }
						}, '保存')
					])
				])
			]),
			E('div', { 'class': 'ms-log-box' }, logPre)
		]);

		return pageEl;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
