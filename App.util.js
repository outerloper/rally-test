function resolvedPromise(value) {
    return Deft.promise.Promise.when(value);
}

function rejectedPromise(error) {
    var deferred = Ext.create("Deft.Deferred");
    deferred.reject(error);
    return deferred.promise;
}

function promiseAll(array) {
    return array.length === 0 ? [] : Deft.Promise.all(array);
}


function getRallyRecordType(record) {
    return record && record.getData()._type;
}

function getRallyIdFromRef(ref, type) {
    return +ref.slice(type.length + 2);
}

function milestoneIcon(milestone) {
    return "<span class='artifact-icon icon-milestone' style='transform:rotate(20deg);color: " + milestone.get("DisplayColor") + ";'></span>";
}

function formatMilestone(milestone, context) {
    return milestoneIcon(milestone) + "<a target='_blank' style='color:#274b6d' href='" + getMilestoneUrl(milestone, context) + "'>" + milestone.get("Name") + "</a>";
}

function getMilestoneUrl(milestone, context) {
    return "https://rally1.rallydev.com/#/" + context.getProject().ObjectID + "d/detail" + milestone.getUri();
}

function formatRelease(release, context) {
    return "<a target='_blank' style='color:#274b6d' href='" + getReleaseUrl(release, context) + "'>" + release.get("Name") + "</a>";
}

function getReleaseUrl(release, context) {
    return "https://rally1.rallydev.com/slm/rl/edit.sp?cpoid=" + context.getProject().ObjectID +
        "&projectScopeUp=" + context.getProjectScopeUp() +
        "&projectScopeDown=" + context.getProjectScopeDown() +
        "&oid=" + release.getId() +
        "&typeDef=27154375554";
}

function formatProject(project, page) {
    return page ? "<a target='_blank' style='color:#274b6d' href='https://rally1.rallydev.com/#/" + project.get("ObjectID") + "d/" + page + "'>" + project.get("Name") + "</a>"
        : project.get("Name");
}

function hasOwnProperties(object, minNumber) {
    minNumber = minNumber ? minNumber : 1;
    for (var property in object) {
        if (object.hasOwnProperty(property)) {
            if (!--minNumber) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Use to display store errors on the console:
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

    console.log("proxy:", proxy, "response:", response, "operation:", operation);
}

function formatDate(date) {
    return Rally.util.DateTime.format((date instanceof Date) ? date : new Date(date), "dMy");
}

function dateToIsoString(date) {
    return date.toISOString().substring(0, 10);
}

function joinNotEmpty(array, glue, prefixIfNotEmpty, suffixIfNotEmpty) {
    var joined = array.filter(function (element) {
        return !!element;
    }).join(glue);
    var prefix = prefixIfNotEmpty ? prefixIfNotEmpty : "";
    var suffix = suffixIfNotEmpty ? suffixIfNotEmpty : "";
    return joined && (prefix || suffix) ? prefix + joined + suffix : joined;
}


function addBusinessDays(date, businessDays) {
    var result = new Date(date);
    var days = result.getDate();
    var d = result.getDay();
    while (businessDays > 0) {
        ++days;
        d = (d + 1) % 7;
        if (d !== 0 && d != 6) {
            --businessDays;
        }
    }
    result.setDate(days);
    return result;
}
