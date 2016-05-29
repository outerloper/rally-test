// code used in development and testing

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

function chartData(dateFrom, days, series) {
    var data = {categories: [], series: series};
    var date = new Date(dateFrom);
    for (var i = 0; i < days; i++) {
        data.categories.push(dateToIsoString(new Date(date)));
        addBusinessDays(date, 1);
    }
    return data;
}

function InProgress(data) {
    return {name: "In Progress", data: data, type: "column", dashStyle: "Solid"};
}

function Completed(data) {
    return {name: "Completed", data: data, type: "column", dashStyle: "Solid"};
}

function Accepted(data) {
    return {name: "Accepted", data: data, type: "column", dashStyle: "Solid"};
}

function Planned(data) {
    return {name: "Planned", data: data, type: "line", dashStyle: "Solid"};
}


function expectCalculation(data, calcConfig) {
    return resolvedPromise({
        chartData: data,
        chartConfig: Ext.create("My.BurnUpCalculation").calculate(data, calcConfig)
    });
}


window.dev = {
    /**
     * The below is used for development purposes, to override/mock app behavior when running from App-dev.html
     */
    app: {
        getMilestoneId: function () {
            //return 53823409519; // d15
            return undefined; // from app context
        },
        getProjectId: function () {
            //return 52219765529; // csm
            //return 52953911025; // fm
            //return 52220062189; // pm
            //return 52220062990; // sm
            //return 53630224881; // smk
            //return 53630226508; // smd
            //return 52219769418; // slm
            //return 52219764059; // s
            //return 52219602590; // a
            return undefined; // from app context
        },
        getDataForChart: function () { // put/remove underscore (_getDataForChart/getDataForChart) to disable/enable this mocked data for chart
            return expectCalculation(chartData("2016-05-10", 5, [
                InProgress([2, 2, 2, 2, 2]),
                Completed([0, 2, 2, 2, 2]),
                Accepted([0, 10, 10, 15, 15]),
                Planned([10, 15, 20, 20, 20])
            ]), {
                customStartDate: new Date("2016-05-11"),
                customProjectionStartDate: new Date("2016-05-12"),
                endDate: new Date("2016-05-16"),
                today: new Date("2016-05-13")
            });
        },
        getDataForChart: function () { // put/remove underscore (_getDataForChart/getDataForChart) to disable/enable this mocked data for chart
            return expectCalculation({
                    "series": [{
                        "name": "In Progress",
                        "data": [0, 0, 0, 0, 0, 8, 8, 13, 13, 26, 27, 26, 18, 5, 13, 21, 16, 16, 16, 21, 21, 21, 21, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
                        "type": "column",
                        "dashStyle": "Solid"
                    }, {
                        "name": "Completed",
                        "data": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 13, 13, 18, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 10, 10, 10, 10, 10, 10, 10, 10],
                        "type": "column",
                        "dashStyle": "Solid"
                    }, {
                        "name": "Accepted",
                        "data": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9, 9, 9, 14, 14, 14, 18, 25, 25, 30, 30, 40, 40, 50, 50, 60, 60, 60, 60, 60, 60],
                        "type": "column",
                        "dashStyle": "Solid"
                    }, {
                        "name": "Planned",
                        "data": [72, 72, 72, 72, 72, 72, 72, 83, 83, 83, 83, 83, 94, 94, 94, 94, 94, 94, 94, 94, 94, 94, 88, 88, 88, 88, 88, 88, 88, 88, 88, 88, 88, 88, 88],
                        "type": "line",
                        "dashStyle": "Solid"
                    }],
                    "categories": [
                        "2016-04-04", "2016-04-05", "2016-04-06", "2016-04-07", "2016-04-08",
                        "2016-04-11", "2016-04-12", "2016-04-13", "2016-04-14", "2016-04-15", "2016-04-18", "2016-04-19", "2016-04-20", "2016-04-21", "2016-04-22",
                        "2016-04-25", "2016-04-26", "2016-04-27", "2016-04-28", "2016-04-29", "2016-05-02", "2016-05-03", "2016-05-04", "2016-05-05", "2016-05-06",
                        "2016-05-09", "2016-05-10", "2016-05-11", "2016-05-12", "2016-05-13", "2016-05-16", "2016-05-17", "2016-05-18", "2016-05-19", "2016-05-20"
                    ]
                }, {
                    maxDaysAfterPlannedEnd: 20,
                    customProjectionStartDate: new Date("2016-05-02"),
                    customStartDate: new Date("2016-04-07"),
                    plannedEndDate: new Date("2016-05-20"),
                    today: new Date("2016-05-13")
                }
            );
        }
    }
};

debug = true;