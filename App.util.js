/**
 * @param {Array} data Array of objects returned by Store object
 * @param {Array} columns If present, returns values only for specified columns, in the provided order. If value is an object, use dot notation to access its property.
 * @returns {string} Lines of tab-separated values
 */
function storeDataToString(data, columns) {
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


function collectIds(objects) {
    return objects.map(function (object) {
        return +object.raw.ObjectID;
    });
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

function formatProject(project, page) {
    return page ? "<a target='_blank' style='color:#274b6d' href='https://rally1.rallydev.com/#/" + project.get("ObjectID") + "d/" + page + "'>" + project.get("Name") + "</a>"
        : project.get("Name");
}

function formatPortfolioItem(portfolioItem, context) {
    return "<a target='_blank' style='color:#274b6d' href='" + getPortfolioItemUrl(portfolioItem, context) + "'><strong style='font-size:0.95em'>" +
        portfolioItem.get("FormattedID") + "</strong> " + portfolioItem.get("Name") + "</a>";
}

function getPortfolioItemUrl(portfolioItem, context) {
    return "https://rally1.rallydev.com/#/" + context.getProject().ObjectID + "d/detail" + portfolioItem.getUri();
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

function chainedExpression(operator, expressions) {
    var joined = expressions.filter(function (expression) {
        return !!expression;
    }).join(") " + operator + " (");
    return "((" + joined + "))";
}

function workItemQuery(data, condition) {
    var itemIDs = data.filter(function (item) {
        return item.data._ValidTo === "9999-01-01T00:00:00.000Z";
    }).filter(condition).map(function (item) {
        return "ObjectID = " + item.data.ObjectID;
    });
    return itemIDs.length > 0 ? chainedExpression("OR", itemIDs) : "* no such items *";
}

function isUserStory(item) {
    return item.data.FormattedID.indexOf("US") === 0;
}

function isDefect(item) {
    return item.data.FormattedID.indexOf("DE") === 0;
}

function isAccepted(item) {
    return item.data.ScheduleState === "Accepted" || item.data.ScheduleState === "Released-to-Production";
}

function addBusinessDays(date, businessDays) {
    var result = new Date(date);
    if (businessDays) {
        var oldTimezoneOffset = result.getTimezoneOffset();
        var days = result.getDate();
        var dayOfMonth = result.getDay();
        var step = businessDays > 0 ? 1 : -1;
        var weekDayStep = businessDays > 0 ? 1 : 6;
        while (businessDays !== 0) {
            days += step;
            dayOfMonth = (dayOfMonth + weekDayStep) % 7;
            if (dayOfMonth !== 0 && dayOfMonth !== 6) {
                businessDays -= step;
            }
        }
        result.setDate(days);
        var offsetDiff = result.getTimezoneOffset() - oldTimezoneOffset;
        if (offsetDiff !== 0) {
            result.setTime(result.getTime() - offsetDiff * 60000);
        }
    }
    return result;
}

function lastBusinessDay(date) {
    var weekDay = new Date(date).getDay();
    return weekDay > 0 && weekDay < 6 ? date : lastBusinessDay(addBusinessDays(date, -1));
}

function parseCapacityPlan(capacityPlanDefinition) {
    if (!capacityPlanDefinition) {
        return null;
    }
    var capacityPlanString = capacityPlanDefinition.toString().trim();
    if (!capacityPlanString) {
        return null;
    }
    var parts = ("1970-01-01 " + capacityPlanString).split(/\s+/);
    var date, previousDate = new Date(-1);
    var capacityPlan = {
        dates: [],
        values: []
    };
    for (var dateIndex = 0, capacityIndex = 1; capacityIndex < parts.length; dateIndex += 2, capacityIndex += 2) {
        date = new Date(parts[dateIndex]);
        if (!parts[dateIndex].match(/^\d\d\d\d-\d\d?-\d\d?$/) || isNaN(date.getTime())) {
            throw "'" + parts[dateIndex] + "' found when a date was expected. The expected format is YYYY-MM-DD";
        }
        if (previousDate >= date) {
            throw "Invalid date: '" + dateToIsoString(date) + "'. It must be greater than '" + dateToIsoString(previousDate) + "'";
        }
        previousDate = date;
        var capacity = parseFloat(parts[capacityIndex]);
        if (!parts[capacityIndex].match(/^[+\-]?(\d*(\.\d+)|\d+)$/) || isNaN(capacity)) {
            throw "'" + parts[capacityIndex] + "' found when a capacity value was expected. It must be a number";
        }
        if (capacity < 0) {
            throw "'" + parts[capacityIndex] + "' found when a capacity value was expected. It must be a positive number";
        }
        capacityPlan.dates.push(dateToIsoString(date));
        capacityPlan.values.push(capacity);
    }
    if (capacityIndex === parts.length) {
        throw "Unexpected value at the end: '" + parts[dateIndex] + "'. Capacity Plan definition must end with a capacity value preceeded by a date";
    }
    capacityPlan.dates.push(dateToIsoString(new Date(9999999999999)));
    return capacityPlan;
}

function createLogger(milestones, portfolioItems, tags, project, fetchFields) {
    return function (store, data, success) {
        var label = "***** DEBUG INFO for MILESTONE BURNUP " + milestones.map(function (milestone) {
                return "<> " + milestone.get("Name");
            }).join(", ");
        if (portfolioItems) {
            label += ": " + portfolioItems.map(function (milestone) {
                    return milestone.get("FormattedID");
                }).join(", ");
        }
        if (tags.length > 0) {
            label += " [" + tags.join("][") + "]";
        }
        label += " - " + project.get("Name") + " ***** ";
        var log = function (title, content) {
            console.debug(label + title + ":");
            console.debug(content);
            console.debug();
        };
        log("DATA SNAPSHOTS", storeDataToString(data, fetchFields));
        log("Query for ALL STORIES", workItemQuery(data, function (item) {
            return isUserStory(item);
        }));
        log("Query for ALL DEFECTS", workItemQuery(data, function (item) {
            return isDefect(item);
        }));
        log("Query for NOT YET ACCEPTED STORIES", workItemQuery(data, function (item) {
            return isUserStory(item) && !isAccepted(item);
        }));
        log("Query for NOT YET ACCEPTED DEFECTS", workItemQuery(data, function (item) {
            return isDefect(item) && !isAccepted(item);
        }));
    };
}

function filterOutUnwantedPortfolioItems(ids, items) {
    return items.filter(function (item) {
        return ids.indexOf(item.get("FormattedID")) !== -1;
    });
}
