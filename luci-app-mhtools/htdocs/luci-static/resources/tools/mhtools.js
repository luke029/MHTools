'use strict';
'require baseclass';
'require uci';
'require fs';
'require rpc';

const callMhtoolsStatus = rpc.declare({
	object: 'luci.mhtools',
	method: 'status',
	expect: { '': {} }
});

const callMhtoolsVersion = rpc.declare({
	object: 'luci.mhtools',
	method: 'version',
	expect: { '': {} }
});

const callMhtoolsListProfiles = rpc.declare({
	object: 'luci.mhtools',
	method: 'list_profiles',
	expect: { '': {} }
});

const callMhtoolsValidateProfile = rpc.declare({
	object: 'luci.mhtools',
	method: 'validate_profile',
	params: ['filename'],
	expect: { '': {} }
});

const callMhtoolsUploadProfile = rpc.declare({
	object: 'luci.mhtools',
	method: 'upload_profile',
	params: ['filename', 'data'],
	expect: { '': {} }
});

const callMhtoolsDeleteProfile = rpc.declare({
	object: 'luci.mhtools',
	method: 'delete_profile',
	params: ['filename'],
	expect: { '': {} }
});

const callMhtoolsSelectProfile = rpc.declare({
	object: 'luci.mhtools',
	method: 'select_profile',
	params: ['filename'],
	expect: { '': {} }
});

const callMhtoolsRestart = rpc.declare({
	object: 'luci.mhtools',
	method: 'restart',
	expect: { '': {} }
});

const callMhtoolsStart = rpc.declare({
	object: 'luci.mhtools',
	method: 'start',
	expect: { '': {} }
});

const callMhtoolsStop = rpc.declare({
	object: 'luci.mhtools',
	method: 'stop',
	expect: { '': {} }
});

const callMhtoolsSetEnabled = rpc.declare({
	object: 'luci.mhtools',
	method: 'set_enabled',
	params: ['value'],
	expect: { '': {} }
});

const callMhtoolsGetDashboardUrl = rpc.declare({
	object: 'luci.mhtools',
	method: 'get_dashboard_url',
	expect: { '': {} }
});

const callMhtoolsGetAllLogs = rpc.declare({
	object: 'luci.mhtools',
	method: 'get_all_logs',
	params: ['lines'],
	expect: { '': {} }
});

const callMhtoolsClearLogs = rpc.declare({
	object: 'luci.mhtools',
	method: 'clear_logs',
	expect: { '': {} }
});

const callMhtoolsGetProfileContent = rpc.declare({
	object: 'luci.mhtools',
	method: 'get_profile_content',
	params: ['filename'],
	expect: { '': {} }
});

const callMhtoolsSaveProfileContent = rpc.declare({
	object: 'luci.mhtools',
	method: 'save_profile_content',
	params: ['filename', 'data'],
	expect: { '': {} }
});

const callMhtoolsReset = rpc.declare({
	object: 'luci.mhtools',
	method: 'reset',
	expect: { '': {} }
});

const callMhtoolsGetAppInfo = rpc.declare({
	object: 'luci.mhtools',
	method: 'get_app_info',
	expect: { '': {} }
});

const callMhtoolsUpgradeApp = rpc.declare({
	object: 'luci.mhtools',
	method: 'upgrade_app',
	expect: { '': {} }
});

const profilesDir = '/etc/mhtools/profiles';

return baseclass.extend({
	profilesDir: profilesDir,

	status: async function () {
		var result = await callMhtoolsStatus();
		return result || { running: false };
	},

	version: function () {
		return callMhtoolsVersion();
	},

	listProfiles: async function () {
		var result = await callMhtoolsListProfiles();
		return (result && result.profiles) ? result.profiles : [];
	},

	validateProfile: function (filename) {
		return callMhtoolsValidateProfile(filename);
	},

	uploadProfile: function (filename, data) {
		return callMhtoolsUploadProfile(filename, data);
	},

	deleteProfile: function (filename) {
		return callMhtoolsDeleteProfile(filename);
	},

	selectProfile: function (filename) {
		return callMhtoolsSelectProfile(filename);
	},

	restart: function () {
		return callMhtoolsRestart();
	},

	start: function () {
		return callMhtoolsStart();
	},

	stop: function () {
		return callMhtoolsStop();
	},

	setEnabled: function (value) {
		return callMhtoolsSetEnabled(value ? '1' : '0');
	},

	getDashboardUrl: function () {
		return callMhtoolsGetDashboardUrl();
	},

	getAllLogs: function (lines) {
		return callMhtoolsGetAllLogs(String(lines));
	},

	clearLogs: function () {
		return callMhtoolsClearLogs();
	},

	getProfileContent: function (filename) {
		return callMhtoolsGetProfileContent(filename);
	},

	saveProfileContent: function (filename, data) {
		return callMhtoolsSaveProfileContent(filename, data);
	},

	reset: function () {
		return callMhtoolsReset();
	},

	getAppInfo: function () {
		return callMhtoolsGetAppInfo();
	},

	upgradeApp: function () {
		return callMhtoolsUpgradeApp();
	},

	formatSize: function (bytes) {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / 1048576).toFixed(2) + ' MB';
	},

	formatTime: function (ts) {
		if (!ts) return '-';
		var d = new Date(ts * 1000);
		return d.toLocaleString();
	}
});
