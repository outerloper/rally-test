function debug(a1, a2) {
    if (window.debug) {
        console.log(a1, a2);
    }
}

/**
 *
 * @param {Array} data Array of objects returned by Rally Store
 * @param {Array} columns If present, returns values only for specified columns, in the provided order
 * @returns {string} Lines of tab-separated values
 */
function rallyDataToString(data, columns) {
    if (!data || !data[0] || !data[0].raw) {
        return "No data to display: " + data;
    }
    var actualColumns = columns || Object.keys(data[0].raw);
    var keys = actualColumns.map(function (column) {
        return column.split('.');
    });
    return data.reduce(function (result, row) {
        result.push(keys.map(function (key) {
            var value = row.raw[key[0]];
            return "" + value == "[object Object]" && key[1] ? value[key[1]] : value;
        }).join('\t'));
        return result;
    }, [actualColumns.join('\t') + '\t' + data.length]).join('\n');
}

/**
 * @param {Object} permissions Permissions Object. When no specified, permission from current Rally app are taken.
 * @returns {string} String representation of permissions
 */
function rallyPermissionsToString(permissions) {
    return (permissions || Rally.getApp().context.getPermissions().userPermissions).map(function (permission) {
        return permission.Role + '\t' + permission._refObjectName;
    }).join('\n');
}

/**
 * Ext.create('Rally.data.lookback.SnapshotStore', {
 *      exceptionHandler: loggingSnapshotStoreExceptionHandler
 *      ...
 * });
 * @param proxy
 * @param response
 * @param operation
 */
function loggingSnapshotStoreExceptionHandler(proxy, response, operation) {
    var messages = JSON.parse(response.responseText);
    var log = function (message) {
        console.log(message);
    };
    console.log("Problem when obtaining snapshot data:");

    messages.Errors.forEach(log);
    messages.Warnings.forEach(log);

    console.log("proxy =", window.proxy = proxy);
    console.log("response =", window.response = response);
    console.log("operation =", window.operation = operation);
}

/**
 * @param {string} projectName E.g. schedule, profit, slot. Fallback to AVPS as a whole
 * @returns {number} Rally ID of project
 */
function avpsProjectId(projectName) {
    switch ((projectName || "").toLowerCase().replace(/[ -_]*/g, "")) {
        case "codeshare":
            return 52219765529;
        case "fleet":
            return 52953911025;
        case "profit":
        case 'network':
            return 52220062189;
        case "schedule":
            return 52220062990;
        case "schedulekrk":
            return 53630224881;
        case "scheduledfw":
            return 53630226508;
        case "slot":
            return 52219769418;
        case "systems":
            return 52219764059;
        default:
            return 52219602590;
    }
}

/**
 * @returns {number} Sabre Production Workspace ID
 */
function sabreWorkspaceId() {
    return 27154375360;
}