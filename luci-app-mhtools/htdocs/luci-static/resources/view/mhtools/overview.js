'use strict';
'require view';
'require uci';
'require poll';
'require ui';
'require fs';
'require tools.mhtools as dp';

var CSS = [
	'.ms-wrap{padding:14px 0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI","PingFang SC",sans-serif;color:#1d1d1f}',
	'.ms-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px;align-items:stretch}',
	'.ms-col{display:flex;flex-direction:column;height:100%}',
	'.ms-card{border-radius:16px;padding:20px;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.05);height:100%;display:flex;flex-direction:column}',
	'.ms-card-title{font-size:15px;font-weight:600;margin-bottom:14px;letter-spacing:-.01em}',
	'.ms-svc-section{padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid rgba(0,0,0,.06)}',
	'.ms-svc-row{display:flex;align-items:center;justify-content:space-between}',
	'.ms-svc-name{font-size:17px;font-weight:600;letter-spacing:-.01em}',
	'.ms-svc-actions{display:flex;align-items:center;gap:16px}',
	'.ms-switch{position:relative;width:46px;height:28px;border:0;border-radius:980px;background:rgba(120,120,128,.16);padding:2px;cursor:pointer;transition:background .25s ease}',
	'.ms-switch .ms-knob{position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.2),0 0 0 0.5px rgba(0,0,0,.04);transition:transform .25s cubic-bezier(.4,0,.2,1)}',
	'.ms-switch.is-on{background:#34c759}',
	'.ms-switch.is-on .ms-knob{transform:translateX(18px)}',
	'.ms-restart-btn{padding:6px 16px;border:1px solid rgba(0,0,0,.08);border-radius:980px;font-size:13px;font-weight:500;cursor:pointer;background:rgba(255,255,255,.8);color:#1d1d1f;transition:all .15s ease}',
	'.ms-restart-btn:hover{background:rgba(0,122,255,.08);border-color:rgba(0,122,255,.2);color:#007aff}',
	'.ms-status-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0}',
	'.ms-status-row + .ms-status-row{border-top:1px solid rgba(0,0,0,.04)}',
	'.ms-status-label{font-size:14px;font-weight:500}',
	'.ms-status-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:980px;font-size:12px;font-weight:600}',
	'.ms-status-badge.run{background:rgba(52,199,89,.12);color:#34c759}',
	'.ms-status-badge.stop{background:rgba(255,69,58,.1);color:#ff453a}',
	'.ms-kernel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}',
	'.ms-kernel-title{font-size:17px;font-weight:600;letter-spacing:-.01em}',
	'.ms-head-btns{display:flex;gap:8px}',
	'.ms-check-btn{padding:6px 14px;border:1px solid #1d1d1f;border-radius:980px;font-size:12px;font-weight:500;cursor:pointer;background:transparent;color:#1d1d1f;transition:all .15s ease}',
	'.ms-check-btn:hover{background:#1d1d1f;color:#fff}',
	'.ms-check-btn:disabled{opacity:.5;cursor:not-allowed}',
	'.ms-ver-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0}',
	'.ms-ver-label{font-size:14px;color:#1d1d1f;flex-shrink:0}',
	'.ms-ver-right{display:flex;align-items:center;gap:10px;flex-shrink:0}',
	'.ms-ver-num{font-size:12px;color:#86868b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
	'.ms-ver-num.has-update{color:#ff9500;font-weight:600}',
	'.ms-ver-btn{padding:3px 10px;border:0;border-radius:980px;font-size:11px;font-weight:600;cursor:pointer;background:#007aff;color:#fff;transition:opacity .15s ease}',
	'.ms-ver-btn:hover{opacity:.85}',
	'.ms-ver-btn:disabled{opacity:.5;cursor:not-allowed}',
	'.ms-profile-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(0,0,0,.04);margin-top:4px;padding-top:14px}',
	'.ms-profile-label{font-size:14px;font-weight:500}',
	'.ms-profile-val{font-size:13px;color:#007aff;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
	'.ms-profile-val.empty{color:#86868b;font-weight:500}',
	'.ms-version-foot{margin-top:auto;padding-top:18px;border-top:1px solid rgba(0,0,0,.06);font-size:11px;color:#86868b;text-align:left;display:flex;justify-content:space-between;align-items:center}',
	'.ms-foot-btns{display:flex;gap:8px;align-items:center}',
	'.ms-section{margin-bottom:16px}',
	'.ms-section-title{font-size:17px;font-weight:700;margin-bottom:10px;letter-spacing:-.02em}',
	'.ms-upload-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}',
	'.ms-upload-left{display:flex;align-items:center;gap:8px}',
	'.ms-upload-btn{padding:5px 14px;border:1px solid rgba(0,0,0,.1);border-radius:980px;font-size:12px;font-weight:500;cursor:pointer;background:rgba(255,255,255,.8);color:#1d1d1f;transition:all .15s ease}',
	'.ms-upload-btn:hover{background:rgba(0,122,255,.08);border-color:rgba(0,122,255,.2);color:#007aff}',
	'.ms-upload-input{display:none}',
	'.ms-upload-status{font-size:12px;color:#86868b}',
	'.ms-upload-status.ok{color:#34c759}',
	'.ms-upload-status.err{color:#ff453a}',
	'.ms-profile-table{width:100%;border-collapse:collapse;font-size:13px}',	
	'.ms-profile-table th{text-align:left;padding:8px 12px;font-weight:600;color:#86868b;font-size:12px}',
	'.ms-profile-table td{padding:8px 12px}',
	'.ms-act-btns{display:flex;gap:8px}',
	'.ms-act-link{font-size:13px;color:#007aff;cursor:pointer;background:none;border:0;padding:0;font-weight:500;transition:opacity .15s ease}',
	'.ms-act-link:hover{opacity:.7}',
	'.ms-act-link.danger{color:#ff453a;background:transparent!important;border:0!important}',
	'.ms-act-link.primary{color:#34c759;font-weight:600}',
	'.ms-link-btn{font-size:13px;color:#007aff;cursor:pointer;background:none;border:0;padding:0;font-weight:500;transition:opacity .15s ease}',
	'.ms-link-btn:hover{opacity:.7}',
	'.ms-edit-area{width:100%;min-height:420px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;padding:12px;border:1px solid rgba(0,0,0,.1);border-radius:8px;background:rgba(255,255,255,.9);color:#1d1d1f;resize:vertical;box-sizing:border-box;tab-size:2;white-space:pre}',
	'.ms-edit-area:focus{outline:none;border-color:#007aff;box-shadow:0 0 0 3px rgba(0,122,255,.1)}',
	'.ms-edit-name{font-size:14px;font-weight:600;margin-bottom:6px}',
	'.ms-edit-hint{font-size:12px;color:#86868b;margin-bottom:10px;line-height:1.5}',
	'.ms-empty{text-align:center;padding:32px;color:#86868b;font-size:13px}',
	'body.dark .ms-wrap,body[data-theme="dark"] .ms-wrap{color:#f5f5f7}',
	'body.dark .ms-card,body[data-theme="dark"] .ms-card{background:rgba(30,30,32,.72);box-shadow:0 1px 3px rgba(0,0,0,.2)}',
	'body.dark .ms-switch,body[data-theme="dark"] .ms-switch{background:rgba(255,255,255,.12)}',
	'body.dark .ms-restart-btn,body[data-theme="dark"] .ms-restart-btn{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1);color:#f5f5f7}',
	'body.dark .ms-status-row + .ms-status-row,body[data-theme="dark"] .ms-status-row + .ms-status-row{border-top-color:rgba(255,255,255,.06)}',
	'body.dark .ms-check-btn,body[data-theme="dark"] .ms-check-btn{border-color:#f5f5f7;color:#f5f5f7}',
	'body.dark .ms-check-btn:hover,body[data-theme="dark"] .ms-check-btn:hover{background:#f5f5f7;color:#1d1d1f}',
	'body.dark .ms-svc-section,body[data-theme="dark"] .ms-svc-section{border-bottom-color:rgba(255,255,255,.06)}',
	'body.dark .ms-profile-row,body[data-theme="dark"] .ms-profile-row{border-top-color:rgba(255,255,255,.06)}',
	'body.dark .ms-version-foot,body[data-theme="dark"] .ms-version-foot{border-top-color:rgba(255,255,255,.06);color:#86868b}',
	'body.dark .ms-upload-btn,body[data-theme="dark"] .ms-upload-btn{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1);color:#f5f5f7}',
	'body.dark .ms-edit-area,body[data-theme="dark"] .ms-edit-area{background:rgba(30,30,32,.9);border-color:rgba(255,255,255,.1);color:#f5f5f7}',
	'body.dark .ms-edit-area:focus,body[data-theme="dark"] .ms-edit-area:focus{border-color:#0a84ff;box-shadow:0 0 0 3px rgba(10,132,255,.15)}',
	'@media(max-width:900px){.ms-grid{grid-template-columns:1fr}}'
].join('');

function statusBadge(running) {
	return E('span', {
		'class': 'ms-status-badge ' + (running ? 'run' : 'stop')
	}, [
		E('span', { style: 'width:6px;height:6px;border-radius:50%;background:currentColor;' }),
		running ? '运行中' : '已停止'
	]);
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('mhtools'),
			dp.version(),
			dp.status(),
			dp.listProfiles()
		]);
	},

	render: function (data) {
		var version = data[1] || {};
		var status = data[2] || { running: false };
		var profiles = data[3] || [];

		function escapeHtml(s) {
			return ('' + (s == null ? '' : s))
				.replace(/&/g, '&amp;').replace(/</g, '&lt;')
				.replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		}

		function shortVersion(v) {
			if (!v) return v;
			var m = ('' + v).match(/Mihomo\s+(\S+)/i);
			if (m) return m[1];
			return ('' + v).split(/\s+/)[0] || v;
		}

		var running = status.running;
		var currentProfile = uci.get('mhtools', 'core', 'profile') || '';
		var mihomoVer = version.core || '';
		var runningVer = version.running_core || '';
		var displayVer = runningVer || mihomoVer || '';
		var displayVerShort = shortVersion(displayVer);
		var kernelInstalled = version.mihomo_installed || false;

		var mihomoStatusEl = E('span', { id: 'ms-mihomo-status' }, statusBadge(running));

		var foreignEl = E('span', {
			'class': 'ms-foreign-warn',
			id: 'ms-foreign',
			style: 'display:' + (status.foreign ? 'inline' : 'none') + ';color:#ff9500;font-size:11px;margin-left:4px;'
		}, '⚠ 检测到其它 mihomo 进程(疑似 Nikki 残留)');

		function updateBadge(el, run) {
			var nb = statusBadge(run);
			el.innerHTML = '';
			while (nb.firstChild) el.appendChild(nb.firstChild);
			el.className = nb.className;
		}

		var switchEl = E('div', {
			'class': 'ms-switch ' + (running ? 'is-on' : ''),
			id: 'ms-main-switch',
			click: function () {
				var targetOn = !switchEl.classList.contains('is-on');
				if (targetOn && !kernelInstalled) {
					alert('Mihomo 内核未安装。请手动下载上传到 /usr/bin/mihomo：\nwget -O /usr/bin/mihomo.gz "https://github.com/MetaCubeX/mihomo/releases/download/v1.19.29/mihomo-linux-arm64-v1.19.29.gz"\ngunzip /usr/bin/mihomo.gz && chmod +x /usr/bin/mihomo');
					return;
				}
				switchEl.classList.toggle('is-on', targetOn);
				ui.showModal(targetOn ? '启动服务' : '停止服务', [
					E('p', { style: 'text-align:center;' }, targetOn ? '正在启动服务...' : '正在停止服务...')
				]);
				if (targetOn) {
					dp.setEnabled(true).then(function () {
						return dp.start();
					}).then(function (r) {
						if (!r || !r.success) throw new Error((r && r.error) || '服务启动未成功');
						setTimeout(function () {
							ui.hideModal();
							location.reload();
						}, 1200);
					}).catch(function (e) {
						switchEl.classList.toggle('is-on', false);
						ui.hideModal();
						alert('操作失败：' + (e && e.message ? e.message : '未知错误'));
					});
				} else {
					dp.stop().then(function (r) {
						if (!r || !r.success) throw new Error((r && r.error) || '服务停止未成功');
						return dp.setEnabled(false).catch(function () {});
					}).then(function () {
						setTimeout(function () {
							ui.hideModal();
							location.reload();
						}, 1200);
					}).catch(function (e) {
						switchEl.classList.toggle('is-on', true);
						ui.hideModal();
						alert('操作失败：' + (e && e.message ? e.message : '未知错误'));
					});
				}
			}
		}, E('div', { 'class': 'ms-knob' }));

		var restartBtn = E('button', {
			'class': 'ms-restart-btn',
			click: function () {
				if (!kernelInstalled) {
					alert('Mihomo 内核未安装。请将内核二进制上传到 /usr/bin/mihomo');
					return;
				}
				ui.showModal('重启服务', [
					E('p', { style: 'text-align:center;' }, '正在重启服务...')
				]);
				return dp.restart().then(function () {
					setTimeout(function () {
						ui.hideModal();
						location.reload();
					}, 1500);
				});
			}
		}, '重启');

		// ===== 编辑配置文件 =====
		function openEditModal(profileName) {
			ui.showModal('编辑配置文件：' + profileName, [
				E('textarea', { 'class': 'ms-edit-area', 'id': 'ms-edit-textarea' }, '加载中...'),
				E('div', { 'class': 'right', style: 'margin-top:12px;' }, [
					E('button', { 'class': 'btn', click: ui.hideModal }, '取消'),
					E('button', { 'class': 'btn cbi-button-positive', 'id': 'ms-edit-save', style: 'margin-left:8px;' }, '保存')
				])
			]);
			dp.getProfileContent(profileName).then(function (r) {
				if (r && r.success) {
					document.getElementById('ms-edit-textarea').value = r.content || '';
				} else {
					document.getElementById('ms-edit-textarea').value = '加载失败：' + (r?.error || '未知错误');
					document.getElementById('ms-edit-save').disabled = true;
				}
			}).catch(function (err) {
				document.getElementById('ms-edit-textarea').value = '加载失败：' + (err?.message || err);
				document.getElementById('ms-edit-save').disabled = true;
			});
			document.getElementById('ms-edit-save').addEventListener('click', function () {
				var content = document.getElementById('ms-edit-textarea').value;
				var saveBtn = document.getElementById('ms-edit-save');
				saveBtn.disabled = true;
				saveBtn.textContent = '保存中...';
				dp.saveProfileContent(profileName, content).then(function (r) {
					ui.hideModal();
					if (r && r.success) {
						setTimeout(function () { location.reload(); }, 1000);
					} else {
						alert('保存失败：' + (r?.error || '未知错误'));
					}
				}).catch(function (err) {
					ui.hideModal();
					alert('保存失败：' + (err?.message || err));
				});
			});
		}

		// ===== 校验配置文件 =====
		function openValidateModal(profileName) {
			ui.showModal('校验配置文件：' + profileName, [
				E('div', { 'class': 'ms-validate-loading', 'id': 'ms-validate-body', style: 'text-align:center;padding:20px;' }, [
					E('p', {}, '正在校验，请稍候...')
				])
			]);
			dp.validateProfile(profileName).then(function (r) {
				var body = document.getElementById('ms-validate-body');
				if (!r) { body.innerHTML = '<p style="color:#ff453a">校验失败：无返回数据</p>'; return; }
				var syntaxClass = r.syntax ? 'ms-validate-ok' : 'ms-validate-fail';
				var kernelClass = r.kernel ? 'ms-validate-ok' : 'ms-validate-fail';
				var syntaxIcon = r.syntax ? '✓' : '✗';
				var kernelIcon = r.kernel ? '✓' : '✗';
				var syntaxText = r.syntax ? '通过' : '未通过';
				var kernelText = r.kernel ? '通过' : (r.warnings && r.warnings.join('').indexOf('skipping kernel') >= 0 ? '跳过（无内核）' : '未通过');
				var html = '<div style="display:flex;flex-direction:column;gap:12px;text-align:left;">';
				html += '<div class="' + syntaxClass + '" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;">';
				html += '<span style="font-weight:600;font-size:14px;">' + syntaxIcon + ' YAML 语法检查</span>';
				html += '<span style="font-size:13px;opacity:.8;">' + syntaxText + '</span></div>';
				html += '<div class="' + kernelClass + '" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;">';
				html += '<span style="font-weight:600;font-size:14px;">' + kernelIcon + ' Mihomo 内核校验</span>';
				html += '<span style="font-size:13px;opacity:.8;">' + kernelText + '</span></div>';
				if (r.errors && r.errors.length > 0) {
					html += '<div style="margin-top:4px;"><div style="font-weight:600;font-size:13px;margin-bottom:6px;color:#ff453a;">错误</div>';
					html += '<pre style="font-size:12px;line-height:1.5;padding:10px;background:rgba(255,69,58,.06);border-radius:6px;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow:auto;">' + escapeHtml(r.errors.join('\n')) + '</pre></div>';
				}
				if (r.warnings && r.warnings.length > 0) {
					html += '<div style="margin-top:4px;"><div style="font-weight:600;font-size:13px;margin-bottom:6px;color:#ff9500;">警告</div>';
					html += '<pre style="font-size:12px;line-height:1.5;padding:10px;background:rgba(255,149,0,.06);border-radius:6px;white-space:pre-wrap;word-break:break-all;">' + escapeHtml(r.warnings.join('\n')) + '</pre></div>';
				}
				html += '</div>';
				body.innerHTML = html;
				// 动态样式
				var okEls = body.querySelectorAll('.ms-validate-ok');
				for (var i = 0; i < okEls.length; i++) {
					okEls[i].style.background = 'rgba(52,199,89,.08)';
					okEls[i].style.color = '#34c759';
				}
				var failEls = body.querySelectorAll('.ms-validate-fail');
				for (var i = 0; i < failEls.length; i++) {
					failEls[i].style.background = 'rgba(255,69,58,.08)';
					failEls[i].style.color = '#ff453a';
				}
			}).catch(function (e) {
				var body = document.getElementById('ms-validate-body');
				if (body) body.innerHTML = '<p style="color:#ff453a;text-align:center;">校验请求失败：' + escapeHtml(e?.message || e) + '</p>';
			});
		}

		// ===== 下载配置文件 =====
		function downloadProfile(profileName) {
			dp.getProfileContent(profileName).then(function (r) {
				if (!r || !r.success) {
					alert('下载失败：' + (r?.error || '未知错误'));
					return;
				}
				var blob = new Blob([r.content], { type: 'text/yaml;charset=utf-8' });
				var a = document.createElement('a');
				a.href = URL.createObjectURL(blob);
				a.download = profileName;
				a.style.display = 'none';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(a.href);
			}).catch(function (e) {
				alert('下载失败：' + (e?.message || e));
			});
		}

		// ===== 构建配置文件列表 =====
		function buildProfileTable() {
			if (!profiles || profiles.length === 0) {
				return E('div', { 'class': 'ms-empty' }, '暂无配置文件，请上传完整的 Mihomo 配置 YAML 文件');
			}
			var rows = profiles.map(function (p) {
				var isCurrent = (p.name == currentProfile);
				return E('tr', {}, [
					E('td', {}, [
						E('span', { style: 'font-weight:600' }, p.name),
						isCurrent ? E('span', { style: 'margin-left:8px;padding:2px 8px;border-radius:980px;background:rgba(52,199,89,.12);color:#34c759;font-size:11px;font-weight:600;' }, '当前使用') : ''
					]),
					E('td', {}, dp.formatSize(p.size)),
					E('td', {}, dp.formatTime(p.mtime)),
					E('td', {}, E('div', { 'class': 'ms-act-btns' }, [
						E('button', {
							'class': 'ms-act-link',
							click: function () { openEditModal(p.name); }
						}, '编辑'),
						isCurrent ? '' : E('button', {
							'class': 'ms-act-link primary',
							click: function () {
								if (!confirm('选用 ' + p.name + ' 作为当前配置？')) return;
								dp.selectProfile(p.name).then(function (r) {
									if (r && r.success) {
										setTimeout(function () { location.reload(); }, 1000);
									} else {
										alert('选用失败：' + (r?.error || '未知错误'));
									}
								}).catch(function (e) {
									alert('选用失败：' + (e?.message || e));
								});
							}
						}, '选用'),
						E('button', {
							'class': 'ms-act-link',
							style: 'color:#ff9500',
							click: function () { openValidateModal(p.name); }
						}, '校验'),
						E('button', {
							'class': 'ms-act-link',
							click: function () { downloadProfile(p.name); }
						}, '下载'),
						E('button', {
							'class': 'ms-act-link danger',
							click: function () {
								if (!confirm('确定删除 ' + p.name + '？')) return;
								dp.deleteProfile(p.name).then(function (r) {
									if (r && r.success) {
										location.reload();
									} else {
										alert('删除失败：' + (r?.error || '未知错误'));
									}
								}).catch(function (e) {
									alert('删除失败：' + (e?.message || e));
								});
							}
						}, '删除')
					]))
				]);
			});
			return E('table', { 'class': 'ms-profile-table' }, [
				E('thead', {}, E('tr', {}, [
					E('th', {}, '文件名'),
					E('th', {}, '大小'),
					E('th', {}, '修改时间'),
					E('th', { style: 'width:240px' }, '操作')
				])),
				E('tbody', {}, rows)
			]);
		}

		// ===== 上传配置文件 =====
		var uploadStatusEl = E('span', { 'class': 'ms-upload-status' });
		var hiddenInput = E('input', { 'class': 'ms-upload-input', type: 'file', id: 'ms-upload-file', accept: '.yaml,.yml' });

		hiddenInput.addEventListener('change', function () {
			var fileEl = document.getElementById('ms-upload-file');
			var file = fileEl && fileEl.files && fileEl.files[0];
			if (!file) return;
			uploadStatusEl.className = 'ms-upload-status';
			uploadStatusEl.textContent = '上传中...';
			var reader = new FileReader();
			reader.onload = function (ev) {
				var data = ev.target.result;
				dp.uploadProfile(file.name, data).then(function (r) {
					if (r && r.success) {
						uploadStatusEl.className = 'ms-upload-status ok';
						uploadStatusEl.textContent = '✓ ' + file.name + ' 上传成功';
						setTimeout(function () { location.reload(); }, 800);
					} else {
						uploadStatusEl.className = 'ms-upload-status err';
						uploadStatusEl.textContent = '✗ ' + (r?.error || '上传失败');
					}
				}).catch(function (e) {
					uploadStatusEl.className = 'ms-upload-status err';
					uploadStatusEl.textContent = '✗ ' + (e?.message || '上传失败');
				});
			};
			reader.readAsText(file);
		});

		function openDashboard() {
			dp.getDashboardUrl().then(function (r) {
				if (!r || !r.available) {
					alert('未检测到面板地址。请确认内核配置中已设置 external-controller 且服务正在运行。');
					return;
				}
				var host = window.location.hostname;
				var proto = (r.port == '443') ? 'https' : 'http';
				var qs = 'hostname=' + encodeURIComponent(host);
				if (r.secret) qs += '&secret=' + encodeURIComponent(r.secret);
				var url = proto + '://' + host + ':' + r.port + '/ui/zashboard/?' + qs;
				window.open(url, '_blank');
			}).catch(function () {
				alert('获取面板地址失败。');
			});
		}

		// ===== 清空配置 =====
		function openResetModal() {
			if (!confirm('确定重置为默认设置吗？\n\n将执行以下操作：\n1. 停止服务\n2. 删除所有配置文件\n3. 重置所有设置')) return;
			ui.showModal('重置默认', [
				E('p', { style: 'text-align:center;' }, '正在重置...')
			]);
			dp.reset().then(function (r) {
				ui.hideModal();
				if (r && r.success) {
					setTimeout(function () { location.reload(); }, 1000);
				} else {
					alert('清空失败：' + ((r && r.error) || '未知错误'));
				}
			}).catch(function (e) {
				ui.hideModal();
				alert('清空失败：' + (e && e.message ? e.message : '未知错误'));
			});
		}

		var dashboardBtnFoot = E('button', {
			'class': 'ms-check-btn',
			click: function () { openDashboard(); }
		}, '打开面板');

		var pageEl = E('div', { 'class': 'ms-wrap' }, [
			E('style', CSS),

			E('div', { 'class': 'ms-grid' }, [
				/* 左侧：服务状态 */
				E('div', { 'class': 'ms-col' }, [
					E('div', { 'class': 'ms-card' }, [
						E('div', { 'class': 'ms-svc-section' }, [
							E('div', { 'class': 'ms-svc-row' }, [
								E('span', { 'class': 'ms-svc-name' }, 'MHTools 服务'),
								E('div', { 'class': 'ms-svc-actions' }, [
									switchEl,
									restartBtn
								])
							])
						]),
						E('div', { 'class': 'ms-status-row' }, [
							E('span', { 'class': 'ms-status-label' }, '运行状态'),
							E('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
								mihomoStatusEl,
								foreignEl
							])
						]),
						E('div', { 'class': 'ms-profile-row' }, [
							E('span', { 'class': 'ms-profile-label' }, '当前配置'),
							E('span', {
								'class': 'ms-profile-val' + (currentProfile ? '' : ' empty'),
								title: currentProfile || '未选择'
							}, currentProfile || '未选择')
						])
					])
				]),

				/* 右侧：内核信息 */
				E('div', { 'class': 'ms-col' }, [
					E('div', { 'class': 'ms-card' }, [
						E('div', { 'class': 'ms-kernel-head' }, [
							E('span', { 'class': 'ms-kernel-title' }, '内核')
						]),
						E('div', { 'class': 'ms-ver-row' }, [
							E('span', { 'class': 'ms-ver-label' }, runningVer ? '运行版本' : '内核版本'),
							E('span', {
								'class': 'ms-ver-num' + (!kernelInstalled ? ' has-update' : ''),
								title: displayVer
							}, kernelInstalled ? (displayVerShort || '已安装') : '未安装')
						]),
						E('div', { 'class': 'ms-version-foot' }, [
							E('span', {}, !kernelInstalled ? '⚠ 内核未安装（上传到 /usr/bin/mihomo）' : (runningVer ? '内核运行中' : '内核已安装')),
							E('div', { 'class': 'ms-foot-btns' }, [
								dashboardBtnFoot,
								E('button', {
									'class': 'ms-check-btn',
									click: function () { openResetModal(); }
								}, '重置默认')
							])
						])
					])
				])
			]),

			/* 配置文件管理 */
			E('div', { 'class': 'ms-card', style: 'margin-bottom:16px;min-height:auto;flex:none;height:auto;padding:14px 16px;' }, [
				E('div', { 'class': 'ms-upload-row' }, [
					E('span', { 'class': 'ms-section-title', style: 'margin:0;' }, '配置文件'),
					E('div', { 'class': 'ms-upload-left' }, [
						uploadStatusEl,
						hiddenInput,
						E('button', {
							'class': 'ms-upload-btn',
							click: function () { document.getElementById('ms-upload-file').click(); }
						}, '上传配置')
					])
				]),
				buildProfileTable()
			])
		]);

		poll.add(function () {
			return L.resolveDefault(dp.status()).then(function (r) {
				if (!r) return;
				updateBadge(mihomoStatusEl, !!r.running);
				if (switchEl) switchEl.classList.toggle('is-on', !!r.running);
				if (foreignEl) foreignEl.style.display = r.foreign ? 'inline' : 'none';
			});
		});

		return pageEl;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
