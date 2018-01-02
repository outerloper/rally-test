// code used in development and testing



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

function Scope(data) {
    return {name: "Scope", data: data, type: "line", dashStyle: "Solid"};
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
        config: {
            defaultSettings: {
                // capacityPlan: "0.5 2017-12-15 1.5 2017-12-20\n0.0 2018-01-03 4.0 2018-01-20\n5",
                capacityPlan: "2 2017-03-31 4 2017-05-03 6 2017-07-08 2 ",
                // capacityPlan: "0 2018-01-28 5",
                // capacityPlan: "0 2018-01-28 -2 2018-01-30 5", // invalid
                // capacityPlan: "0 2018-01-28 2018-01-30 5", // invalid
                // capacityPlan: "0 1 2018-01-28 2 2018-01-30 5", // invalid
                // capacityPlan: "0 2018-01-28 2 2018-01-30", // invalid
                // capacityPlan: "0 2018-01-28 2 2018-01-01 3", // invalid
                // capacityPlan: "invalid", // invalid
                // capacityPlan: " ", // should be ignored
                // capacityPlan: "1", // should behave like no plan defined
                // capacityPlan: "0", // should be ignored/behave like no plan defined
                //customTrendStartDate: "2016-03-01",
                // customTrendStartDate: "2017-11-27",
                //customStartDate: "2016-05-05",
                maxDaysAfterTargetDate: 45,
                markAuxDates: true,
                drawIterations: true,
                displayWidth: 50,
                //project: "/project/52219765529", // csm
                //project: "/project/52953911025", // fm
                //project: "/project/52220062189", // pm
                // project: "/project/52220062990", // sm
                // project: "/project/52121885700", // FPM Charlie
                // project: "/project/53630224881", // smk
                project: "/project/53630226508", // smd
                //project: "/project/52219769418", // slm
                //project: "/project/52219764059", // s
                // project: "/project/52219602590", // a
                //project: "/project/29475348986", // css/int
                //project: "/project/27159833906", // css
                //project: undefined, // from app context
                // teamFeatures: "TF10560, TF15110", // 15.2
                // teamFeatures: "TF13374, TF13360, TF18854, TF19226, TF13393, TF13397", // 16.0
                // teamFeatures: "77426086652, 59291054867, 59287501066, 59286613915, 59284079199, 80859898716", // 16.0
                // teamFeatures: "TF29957, TF29959, TF28954", // 16.2
                // teamFeatures: "TF29957", // 16.2
                // teamFeatures: "29957 29959;tf28954", // 16.2
                // teamFeatures: "NON_EX", // non existing
                debug: true,
                xxxx: null
            }
        },

        getMilestoneIds: function () {
            //return [55779773422]; // b
            //return [53884362051]; // 14.3
            //return [60559020830]; // d14.5
            // return [53823409519]; // d15.1
            // return [58358658496]; // AC-FPM 4.12.3
            //return [53823409519, 53823678379]; // d15.1 s15.1
            //return [53823678379]; // s15.1
            // return [55681896657]; // d15.2
            //return [55692822039]; // d15.3
            return [53888803641]; // d16.0
            // return [54389009403]; // s16.0
            // return [130767064724]; // d16.2
            //return [49774672980]; // css/int/rel7.3
            //return [53823409519, 53823678379];
            // return []; // from app context
        },
        _getDataForChart: function () { // put/remove underscore (_getDataForChart/getDataForChart) to disable/enable this mocked data for chart
            this.setDataLoaded(true);
            return expectCalculation(chartData("2016-05-10", 5, [
                InProgress([2, 2, 2, 2, 2]),
                Completed([0, 2, 2, 2, 2]),
                Accepted([0, 10, 10, 15, 15]),
                Scope([10, 15, 20, 20, 20])
            ]), {
                customStartDate: new Date("2016-05-11"),
                customProjectionStartDate: new Date("2016-05-12"),
                endDate: new Date("2016-05-16"),
                today: new Date("2016-05-13")
            });
        },
        _getDataForChart: function () { // put/remove underscore (_getDataForChart/getDataForChart) to disable/enable this mocked data for chart
            this.setDataLoaded(true);
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
                        "name": "Scope",
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
                    maxDaysAfterTargetDate: 20,
                    customProjectionStartDate: new Date("2016-05-02"),
                    customStartDate: new Date("2016-04-07"),
                    targetDate: new Date("2016-05-20"),
                    today: new Date("2016-05-13")
                }
            );
        }
    }
};
