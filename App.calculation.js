Ext.define("My.BurnUpCalculation", {

    /**
     * @param {Object} config
     * @param {Object} data
     {
         series: [
             {name: "Scope", data: [12, 14, 14, 15, ...] }, ...
         ],
         categories: ["2016-03-28", "2016-03-29", ...]
     }
     * @ {Object} chartConfig
     */
    calculate: function (data, config) {
        this.calcConfig = {
            today: config.today || new Date(),
            maxEndDate: config.maxEndDate,
            iteration: config.iteration,
            capacityPlan: config.capacityPlan,
            auxDates: config.auxDates,
            drawIterations: config.drawIterations,
            targetDate: config.targetDate,
            customStartDate: config.customStartDate,
            maxDaysAfterTargetDate: config.maxDaysAfterTargetDate,
            customTrendStartDate: config.customTrendStartDate,
            displayWidth: config.displayWidth
        };

        var tooltipStructure = {
            "Scope": {position: 0},
            "Not Started": {position: 1},
            "In Progress": {position: 2},
            "Completed": {position: 3},
            "Accepted": {position: 4}
        };
        var capacityProvider = {
            capacity: function (index) {
                return this.projectionCalculator.capacityPlan ? this.projectionCalculator.stepWeight(index) : null;
            },
            idealBurnUp: function (index) {
                return this.idealSeries && this.idealSeries[index - 1] && this.idealSeries[index] ? this.idealSeries[index] - this.idealSeries[index - 1] : null;
            }
        };
        this.capacityProvider = capacityProvider;

        this.chartConfig = {
            xAxis: {
                plotLines: []
            },
            yAxis: {},
            subtitle: {
                useHTML: true
            },
            tooltip: {
                formatter: function () {
                    var model = {
                        categories: [],
                        get: function (series) {
                            return model.categories[tooltipStructure[series].position];
                        },
                        set: function (series, object) {
                            model.categories[tooltipStructure[series].position] = object;
                        }
                    };
                    this.points.forEach(function (p) {
                        model.set(p.series.name, {value: p.y, name: p.series.name, color: p.series.color});
                    });
                    if (model.get("Scope")) {
                        if (model.get("In Progress") && model.get("Completed") && model.get("Accepted")) {
                            model.set("Not Started", {
                                value: model.get("Scope").value - model.get("In Progress").value - model.get("Completed").value - model.get("Accepted").value,
                                name: "Not Started",
                                color: "#CFCFCF"
                            });
                        }
                    }
                    model.categories.forEach(function (category) {
                        category.valueWholePart = Math.floor(category.value);
                        category.valueDecimalPart = Math.floor(Math.round((category.value - category.valueWholePart) * 10));
                        if (category.valueDecimalPart) {
                            model.isValueDecimalPart = true;
                        }
                        if (model.get("Scope")) {
                            var perMil = Math.round(category.value / model.get("Scope").value * 1000);
                            var percentWholePart = Math.floor(perMil / 10);
                            category.percent = percentWholePart + "." + Math.floor(Math.round((perMil - percentWholePart * 10))) + "%";
                        }
                    });
                    var tooltip = "<table style='border-spacing: 1ex 0; width: 100%'><caption style='padding-bottom: 0.4em'>" + this.x + "</caption>";
                    model.categories.forEach(function (category) {
                        if (category.value > 0) {
                            var valueHTML = category.valueWholePart + (model.isValueDecimalPart ? "." + category.valueDecimalPart : "");
                            tooltip += "<tr>" +
                                "<td style='color:" + category.color + "'>" + category.name + ":</td>" +
                                "<td style='font-weight: bold; text-align: right'>" + valueHTML + "</td>" +
                                (category.percent ? "<td style='text-align: right'>" + category.percent + "</td>" : "") +
                                "</tr>";
                        }
                    });
                    tooltip += "</table>";
                    var footer = [];
                    var index = this.points[0].point.x;
                    var capacity = capacityProvider.capacity(index);
                    if (capacity !== null) {
                        footer.push("Planned capacity: " + capacity);
                    }
                    var velocity = capacityProvider.idealBurnUp(index);
                    if (velocity !== null) {
                        footer.push("Ideal burnup: <b>" + velocity.toFixed(2) + "</b>");
                    }
                    if (footer) {
                        tooltip += "<div style='padding-top: 0.8em; text-align: center; font-size: 0.9em'>" + footer.join("<br/>") + "</div>";
                    }
                    return tooltip;
                },
                useHTML: true,
                shared: true
            }
        };

        this.adjustChartStart(data);
        this.stripFutureBars(data);
        this.addTrendLinesAndSubtitle(data);
        this.adjustDataAndChartConfig(data);

        return this.chartConfig;
    },

    adjustChartStart: function (data) {
        var firstInProgressIndex = this.findDateIndex(data.categories, this.calcConfig.today, false, data.categories.length);
        data.series.forEach(function (series) {
            if (series.name !== "Scope") {
                for (var i = 0; i < series.data.length; i++) {
                    if (series.data[i] > 0 && i < firstInProgressIndex) {
                        firstInProgressIndex = i;
                        break;
                    }
                }
            }
        });
        var startIndex = this.calcConfig.customStartDate ? this.findDateIndex(data.categories, this.calcConfig.customStartDate, false, 0) : firstInProgressIndex;
        data.series.forEach(function (series) {
            series.data = series.data.slice(startIndex);
        });
        data.categories = data.categories.slice(startIndex);
    },

    stripFutureBars: function (data) {
        var currentIndex = this.findDateIndex(data.categories, this.calcConfig.today, false, data.categories.length) + 1;
        data.series.forEach(function (series) {
            if (series.name !== "Scope") {
                for (var i = currentIndex; i < series.data.length; i++) {
                    series.data[i] = null;
                }
            }
        });
    },

    addVerticalLine: function (label, index, config) {
        if (index === -1) {
            return;
        }
        var plotLines = this.chartConfig.xAxis.plotLines;
        for (var i = 0; i < plotLines.length; i++) {
            if (plotLines[i].value === index) {
                label = plotLines[i].label.text + " / " + label;
                plotLines.splice(i, 1);
            }
        }
        plotLines.push(Ext.merge(
            {label: {text: label, y: 3, x: 3, useHTML: true}, value: index, width: 2, color: "#000", zIndex: 5},
            config
        ));
    },

    addSeriesLine: function (data, name, series, config) {
        if (series) {
            data.series.push(Ext.merge(
                {name: name, data: series, type: "line", marker: {enabled: false}, enableMouseTracking: false, lineWidth: 1},
                config
            ));
        }
    },

    addSubtitleText: function (text) {
        var subtitle = this.chartConfig.subtitle;
        subtitle.text = subtitle.text ? subtitle.text + " &nbsp;&nbsp;&nbsp; " + text : text;
    },

    addTrendLinesAndSubtitle: function (data) {
        var config = this.calcConfig;
        var acceptedData = this.getSeriesData(data, "Accepted");
        var plannedData = this.getSeriesData(data, "Scope");
        var dates = data.categories;
        var todayIndex = this.findDateIndex(dates, config.today);
        var targetDateIndex = this.findDateIndex(dates, this.calcConfig.targetDate);
        var todayAcceptedPoints = acceptedData[todayIndex];
        var todayPlannedPoints = plannedData[todayIndex];
        var projectionStart = this.getTrendStart(dates, acceptedData);
        var trendSeries;
        var completedIndex;
        var projectionCalculator = this.createProjectionCalculator({
            capacityPlan: this.calcConfig.capacityPlan,
            projectionStart: projectionStart,
            firstDate: dates[0]
        });
        this.capacityProvider.projectionCalculator = projectionCalculator;
        if (this.calcConfig.targetDate) {
            var idealSeries = projectionCalculator.projectionSeries(targetDateIndex, plannedData[targetDateIndex], targetDateIndex);
            this.capacityProvider.idealSeries = idealSeries;
            this.addSeriesLine(data, "Ideal", idealSeries, {dashStyle: "Dot"});
            this.addSubtitleText("Target Date" + ": " + formatDate(this.calcConfig.targetDate));
        }
        var trendControlIndex = todayIndex;
        // when scope completed
        if (todayAcceptedPoints === todayPlannedPoints && todayPlannedPoints > 0) {
            var k = trendControlIndex - 1;
            while (acceptedData[k] === todayPlannedPoints || acceptedData[k] === null && plannedData[k] === todayPlannedPoints) {
                trendControlIndex--;
                k--;
            }
            completedIndex = trendControlIndex;
        } else {
            var lastIndex = dates.length - 1;
            var lastPlannedPoints = plannedData[lastIndex];
            if (acceptedData[lastIndex] === lastPlannedPoints && lastPlannedPoints > 0) {
                completedIndex = lastIndex;
                var l = lastIndex - 1;
                while (acceptedData[l] === lastPlannedPoints || acceptedData[l] === null && plannedData[l] === lastPlannedPoints) {
                    completedIndex--;
                    l--;
                }
            }
        }
        var projectedDateIndex;
        var maxIndex;
        if (trendControlIndex !== -1) {
            var maxDaysAfterTargetDate = this.calcConfig.maxDaysAfterTargetDate || 0;
            maxIndex = Math.max(todayIndex, (targetDateIndex === -1 ? trendControlIndex : targetDateIndex) + maxDaysAfterTargetDate);
            // draw trend
            var trendFactor = projectionCalculator.projectionFactor(trendControlIndex, todayAcceptedPoints, Infinity, todayPlannedPoints);
            if (trendFactor !== Infinity) {
                trendSeries = projectionCalculator.projectionSeries(trendControlIndex, todayAcceptedPoints, Infinity, todayPlannedPoints);
                if (trendSeries) {
                    this.addSeriesLine(data, "Trend", trendSeries.slice(0, maxIndex + 1), {dashStyle: "Dash"});
                    projectedDateIndex = trendSeries.length - 1;
                    this.projectedEndDate = addBusinessDays(new Date(dates[0]), projectedDateIndex);
                    if (!completedIndex && this.projectedEndDate) {
                        this.addSubtitleText("Projected Date" + ": " + formatDate(this.projectedEndDate));
                    }
                }
            }
            // expand categories and scope line beyond today
            for (var j = Math.max(todayIndex, targetDateIndex, dates.length - 1); j < maxIndex; j++) {
                plannedData.push(todayPlannedPoints);
                dates.push(dateToIsoString(addBusinessDays(new Date(dates[dates.length - 1]), 1)));
            }
        }
        var spliceIndex;
        var deleteCount = dates.length;
        if (completedIndex) {
            // do not display completed columns after target date
            spliceIndex = Math.max(completedIndex, targetDateIndex) + 1;
            dates.splice(spliceIndex, deleteCount);
            acceptedData.splice(spliceIndex, deleteCount);
            plannedData.splice(spliceIndex, deleteCount);
            this.getSeriesData(data, "In Progress").splice(spliceIndex, deleteCount);
            this.getSeriesData(data, "Completed").splice(spliceIndex, deleteCount);
            this.addSubtitleText("Accepted" + ": " + formatDate(dates[completedIndex]));
        } else {
            // truncate not interesting data from the right
            var ifEmpty = function(index, ifEmpty) {
                return index === -1 || index === null || index === undefined ? ifEmpty : index;
            };
            spliceIndex = Math.max(ifEmpty(todayIndex, 0), ifEmpty(targetDateIndex, 0), Math.min(ifEmpty(projectedDateIndex, null), ifEmpty(maxIndex, null))) + 1;
            if (spliceIndex) {
                dates.splice(spliceIndex, deleteCount);
                plannedData.splice(spliceIndex, deleteCount);
            }
        }
        this.addPlotLines(dates, projectedDateIndex, completedIndex);
        // ignore too big historical scope for better readability of the chart
        var maxPlannedPoints = plannedData.reduce(function (e, max) {
            return e > max ? e : max;
        }, 0);
        var yMax = todayPlannedPoints * 1.3;
        if (maxPlannedPoints > yMax) {
            this.chartConfig.yAxis.max = yMax;
        }
        if (config.drawIterations) {
            this.addIterationsBands(dates);
        }
    },

    addPlotLines: function (dates, projectedEndIndex, completedIndex) {
        var config = this.calcConfig;
        if (config.auxDates && hasOwnProperties(config.auxDates, 1)) {
            for (var auxDate in config.auxDates) {
                if (config.auxDates.hasOwnProperty(auxDate)) {
                    this.addVerticalLine(config.auxDates[auxDate], this.findDateIndex(dates, auxDate, true), {width: 1, label: {x: 2}});
                }
            }
        }
        this.addVerticalLine("Today", this.findDateIndex(dates, config.today, true), {color: "#AAA", dashStyle: "ShortDash"});
        this.addVerticalLine("Target Date", this.findDateIndex(dates, config.targetDate, true));
        if (completedIndex) {
            this.addVerticalLine("Accepted", completedIndex, {color: "#774"});
        } else if (projectedEndIndex) {
            this.addVerticalLine("Projected Date", projectedEndIndex, {dashStyle: "ShortDash"});
        }
    },

    addIterationsBands: function (dates) {
        var config = this.calcConfig;
        var iterationStartDate = config.iteration.get("StartDate");
        var iterationEndDate = config.iteration.get("EndDate");
        var iterationDuration = 0;
        var date = iterationStartDate;
        while (date < iterationEndDate) {
            date = addBusinessDays(date, 1);
            iterationDuration++;
        }
        var band = true;
        var startDate = iterationStartDate;
        while (dateToIsoString(startDate) > dates[0]) {
            startDate = addBusinessDays(startDate, -iterationDuration);
            band = !band;
        }
        do {
            startDate = addBusinessDays(startDate, iterationDuration);
            band = !band;
        } while (dateToIsoString(startDate) < dates[0]);

        var startIndex = this.findDateIndex(dates, startDate);
        if (startIndex === -1) {
            return;
        }

        var color = "#F8F9FD";
        this.chartConfig.xAxis.plotBands = [];
        var i = startIndex - (band ? iterationDuration : 0);
        do {
            this.chartConfig.xAxis.plotBands.push({color: color, from: Math.max(0, i), to: i + iterationDuration});
            i += iterationDuration * 2;
        } while (i < dates.length);
    },


    getTrendStart: function (dates, acceptedData) {
        var index;
        if (this.calcConfig.customTrendStartDate) {
            index = this.findDateIndex(dates, this.calcConfig.customTrendStartDate, false, 0);
        } else {
            for (index = 0; index < acceptedData.length; index++) {
                if (acceptedData[index] > 0) {
                    break;
                }
            }
        }
        return {index: index, value: acceptedData[index] || 0};
    },

    findDateIndex: function (dates, date, floating, defaultIndex) {
        var searchedDateString = (date instanceof Date) ? dateToIsoString(date) : date;
        if (dates.length > 0 && dates[0] <= searchedDateString) {
            for (var i = 0; i < dates.length; i++) {
                var dateString = dates[i];
                if (dateString >= searchedDateString) {
                    return dateString > searchedDateString ? i - (floating ? 0.5 : 1) : i;
                }
            }
        }
        return defaultIndex || defaultIndex === 0 ? defaultIndex : -1;
    },

    getSeriesData: function (data, name) {
        for (var i = 0; i < data.series.length; i++) {
            var s = data.series[i];
            if (s.name === name) {
                return s.data;
            }
        }
        return [];
    },

    adjustDataAndChartConfig: function (data) {
        data.categories = data.categories.map(function (date) {
            return formatDate(date);
        });
        var displayWidth = Math.max(Math.min(+this.calcConfig.displayWidth || 100, 500), 10);
        var threshold = data.categories.length * (100 / displayWidth);
        var step, lineWidth, groupPadding, markerEnabled;
        if (threshold > 360) {
            groupPadding = 0;
            lineWidth = 3;
            step = 30;
        } else if (threshold > 240) {
            groupPadding = 0.05;
            lineWidth = 3;
            step = 20;
        } else if (threshold > 120) {
            groupPadding = 0.1;
            lineWidth = 3;
            step = 10;
        } else {
            groupPadding = 0.15;
            markerEnabled = true;
            lineWidth = 3;
            step = 5;
        }
        Ext.merge(this.chartConfig, {
            xAxis: {
                labels: {
                    step: step
                }
            },
            plotOptions: {
                line: {
                    marker: {enabled: markerEnabled},
                    lineWidth: lineWidth
                },
                column: {
                    groupPadding: groupPadding
                }
            }
        });
    },

    createProjectionCalculator: function (config) {
        return config.capacityPlan ?
            Ext.create("My.FlexProjectionCalculator", config) :
            Ext.create("My.FixedProjectionCalculator", config);
    }
});

Ext.define("My.FixedProjectionCalculator", {
    constructor: function (config) {
        this.callParent(arguments);
        this.startIndex = config.projectionStart.index;
        this.startValue = config.projectionStart.value;
    },

    projectionFactor: function (endIndex, endValue) {
        if (this.startIndex >= 0 && this.startIndex < endIndex && this.startValue !== endValue) {
            return this._projectionFactor(endIndex, endValue);
        } else {
            console.log("Unable to calculate trend step for values: (startIndex=" +
                this.startIndex + ", startValue=" + this.startValue + ", endIndex=" + endIndex + ", endValue=" + endValue + ")"
            );
            return null;
        }
    },

    projectionSeries: function (endIndex, endValue, indexLimit, valueLimit) {
        var projectionFactor = this.projectionFactor(endIndex, endValue);
        if (projectionFactor && indexLimit !== 0) {
            var data = [];
            var i;
            for (i = 0; i < this.startIndex; i++) {
                data[i] = null;
            }
            data[i] = this.startValue;
            i++;
            var actualIndexLimit = indexLimit || Infinity;
            for (; i <= actualIndexLimit && (!valueLimit || data[i - 1] + 0.000000001 < valueLimit); i++) {
                data[i] = data[i - 1] + projectionFactor * this.stepWeight(i);
            }
            return data;
        } else {
            return null;
        }
    },

    stepWeight: function (index) {
        return 1;
    },

    _projectionFactor: function (endIndex, endValue) {
        return (endValue - this.startValue) / (endIndex - this.startIndex);
    }
});

Ext.define("My.FlexProjectionCalculator", {
    extend: "My.FixedProjectionCalculator",

    constructor: function (config) {
        this.callParent(arguments);
        this.capacity = [];
        this.capacityPlan = config.capacityPlan;
        this.capacityPlanCursor = 0;
        this.dateCursor = config.firstDate;
    },

    stepWeight: function (index) {
        if (this.capacity[index]) {
            return this.capacity[index];
        }
        for (var i = this.capacity.length; i <= index; i++) {
            if (this.dateCursor >= this.capacityPlan.dates[this.capacityPlanCursor + 1]) {
                this.capacityPlanCursor++;
            }
            this.capacity[i] = this.capacityPlan.values[this.capacityPlanCursor];
            this.dateCursor = dateToIsoString(addBusinessDays(this.dateCursor, 1));
        }
        return this.capacity[index];
    },

    _projectionFactor: function (endIndex, endValue) {
        var weightSum = 0;
        for (var i = this.startIndex + 1; i <= endIndex; i++) {
            weightSum += this.stepWeight(i);
        }
        return (endValue - this.startValue) / weightSum;
    }
});
