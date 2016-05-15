window.dev = {
    /**
     *
     * @param {Array} data Array of objects returned by Rally Store
     * @param {Array} columns If present, returns values only for specified columns, in the provided order. If value is an object, use dot notation to access its property.
     * @returns {string} Lines of tab-separated values
     */
    rallyDataToString: function (data, columns) {
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
    },

    projects: {
        csm: 52219765529,
        fm: 52953911025,
        pm: 52220062189,
        sm: 52220062990,
        smk: 53630224881,
        smd: 53630226508,
        slm: 52219769418,
        s: 52219764059,
        a: 52219602590
    },

    milestones: {
        d15: 53823409519
    },

    app: {
        getMilestoneId: function () {
            return dev.milestones.d15
        },
        getProjectId: function () {
            return dev.projects.fm;
        },
        _getDataForChart: function () {
            var data = {
                "series": [{
                    "name": "In Progress",
                    "data": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 13, 13, 26, 27, 26, 18, 5, 13, 21, 16, 16, 16, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21],
                    "type": "column",
                    "dashStyle": "Solid"
                }, {
                    "name": "Completed",
                    "data": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 13, 13, 18, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13],
                    "type": "column",
                    "dashStyle": "Solid"
                }, {
                    "name": "Accepted",
                    "data": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 9, 9, 9, 9, 9, 14, 14, 14, 18, 25, 25, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
                    "type": "column",
                    "dashStyle": "Solid"
                }, {
                    "name": "Planned",
                    "data": [82, 82, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72, 83, 83, 83, 83, 83, 94, 94, 94, 94, 94, 94, 94, 94, 94, 94, 88, 88, 88, 88, 88, 88, 88, 88, 88, 88, 88, 88, 88],
                    "type": "line",
                    "dashStyle": "Solid"
                }],
                "categories": [
                    "2016-03-28", "2016-03-29", "2016-03-30", "2016-03-31", "2016-04-01", "2016-04-04", "2016-04-05", "2016-04-06", "2016-04-07", "2016-04-08",
                    "2016-04-11", "2016-04-12", "2016-04-13", "2016-04-14", "2016-04-15", "2016-04-18", "2016-04-19", "2016-04-20", "2016-04-21", "2016-04-22",
                    "2016-04-25", "2016-04-26", "2016-04-27", "2016-04-28", "2016-04-29", "2016-05-02", "2016-05-03", "2016-05-04", "2016-05-05", "2016-05-06",
                    "2016-05-09", "2016-05-10", "2016-05-11", "2016-05-12", "2016-05-13", "2016-05-16", "2016-05-17", "2016-05-18", "2016-05-19", "2016-05-20"
                ]
            };

            var calculator = Ext.create("My.MilestoneBurnUpCalculator");
            calculator.endDate = new Date(data.categories[data.categories.length - 1]);
            calculator.today = new Date("2016-05-07");
            calculator.postProcessCalculation(data);

            return resolvedPromise({
                chartData: data,
                chartConfig: calculator.chartConfig
            });
        }
    }
};

debug = true;