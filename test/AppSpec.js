function expectCalculation(data, calcConfig) {
    return {
        toReturn: function (expectedData, expectedChartConfig) {
            console.log(JSON.stringify(data));

            var actualChartConfig = Ext.create("My.BurnUpCalculation").calculate(data, calcConfig);
            expect(data.categories).toEqual(expectedData.categories, "in categories");
            var i;
            for (i = 0; i < expectedData.series.length; i++) {
                expect(data.series[i]).toEqual(expectedData.series[i], "in expected series <" + expectedData.series[i].name + ">");
            }
            expect(data.series[i]).toEqual(undefined, "surplus series");
            for (i = 0; i < expectedChartConfig.xAxis.plotLines.length; i++) {
                expect(actualChartConfig.xAxis.plotLines[i]).toEqual(expectedChartConfig.xAxis.plotLines[i], "in chartConfig.xAxis.plotLines[" + i + "]");
            }
            expect(actualChartConfig.xAxis).toEqual(expectedChartConfig.xAxis, "in chartConfig.xAxis");
            expect(actualChartConfig.subtitle).toEqual(expectedChartConfig.subtitle, "in chartConfig.subtitle");
        }
    };
}

function Projection(data) {
    return {name: "Projection", data: data, type: "line", dashStyle: "Dash", marker: {enabled: false}, enableMouseTracking: false, lineWidth: 1};
}

function Ideal(data) {
    return {name: "Ideal", data: data, type: "line", dashStyle: "Dot", marker: {enabled: false}, enableMouseTracking: false, lineWidth: 1};
}

function subtitle(parts) {
    return parts ? {text: parts.join(" &nbsp;&nbsp;&nbsp; "), useHTML: true} : {useHTML: true};
}

function plannedEndLine(index) {
    return {value: index, color: '#000', width: 2, label: {text: 'planned end'}};
}

function projectedEndLine(index) {
    return {value: index, color: '#BBB', width: 2, label: {text: 'projected end'}};
}

function todayLine(index) {
    return {value: index, color: '#BBB', width: 2, label: {text: 'today'}, dashStyle: 'ShortDash'};
}

describe('Calculation for chart', function () {
    it('typical case: series when work not yet started removed, points in future zeroed, projections calculated from first accepted', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 4, 4]),
            Accepted([0, 0, 2, 8, 8]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 4, null]), Accepted([0, 2, 8, null]), Scope([15, 20, 20, 20]), Projection([null, 2, 8, 14]), Ideal([null, 2, 11, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(2)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 17May16"])
            }
        );
    });

    it('when custom projection start date on day without work accepted: projection and ideal is drawn from that date, from 0 points', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 4, 4]),
            Accepted([0, 0, 2, 8, 8]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            customTrendStartDate: new Date("2016-05-11"),
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 4, null]), Accepted([0, 2, 8, null]), Scope([15, 20, 20, 20]), Projection([0, 4, 8, 12]), Ideal([0, 20 / 3, 20 / 3 * 2, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(2)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 18May16"])
            }
        );
    });

    it('when non-zero max days after planned end set: chart is extended to show a projection after planned end', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 4, 4]),
            Accepted([0, 0, 2, 8, 8]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            maxDaysAfterTargetDate: 10,
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16', '17May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 4, null]), Accepted([0, 2, 8, null]), Scope([15, 20, 20, 20, 20]), Projection([null, 2, 8, 14, 20]), Ideal([null, 2, 11, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(2), projectedEndLine(4)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 17May16"])
            }
        );
    });

    it('when not enough days after planed end set to show whole projection: projection is limited to this number of days and no projected end line', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 4, 4]),
            Accepted([0, 0, 4, 8, 8]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            maxDaysAfterTargetDate: 1,
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16', '17May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 4, null]), Accepted([0, 4, 8, null]), Scope([15, 20, 20, 20, 20]), Projection([null, 4, 8, 12, 16]), Ideal([null, 4, 12, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(2)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 18May16"])
            }
        );
    });

    it('with custom chart start date later than default: series before that date truncated, also projected end line not drawn as is the same as planned end', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([2, 2, 2, 2, 2]),
            Completed([0, 2, 2, 2, 2]),
            Accepted([0, 10, 10, 15, 15]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            customStartDate: new Date("2016-05-12"),
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['12May16', '13May16', '16May16'],
                series: [InProgress([2, 2, null]), Completed([2, 2, null]), Accepted([10, 15, null]), Scope([20, 20, 20]), Projection([10, 15, 20]), Ideal([10, 15, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(2), todayLine(1)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 16May16"])
            }
        );
    });

    it('with custom start date earlier than default: existing data for days before default start not removed but displayed', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 4, 4]),
            Accepted([0, 0, 2, 8, 8]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            customStartDate: new Date("2016-05-01"),
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['10May16', '11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([0, 4, 3, 2, null]), Completed([0, 0, 5, 4, null]), Accepted([0, 0, 2, 8, null]), Scope([10, 15, 20, 20, 20]), Projection([null, null, 2, 8, 14]), Ideal([null, null, 2, 11, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(4), todayLine(3)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 17May16"])
            }
        );
    });

    it('with custom chart start date and custom projection date: appropriate days truncated and projection calculated for custom date', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([2, 2, 2, 2, 2]),
            Completed([0, 2, 2, 2, 2]),
            Accepted([0, 10, 10, 15, 15]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            customStartDate: new Date("2016-05-11"),
            customTrendStartDate: new Date("2016-05-12"),
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([2, 2, 2, null]), Completed([2, 2, 2, null]), Accepted([10, 10, 15, null]), Scope([15, 20, 20, 20]), Projection([null, 10, 15, 20]), Ideal([null, 10, 15, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(2)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 16May16"])
            }
        );
    });

    it('today is weekend: today line drawn between Friday and Monday', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 4, 7]),
            Accepted([0, 0, 2, 8, 5]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-14")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 4, null]), Accepted([0, 2, 8, null]), Scope([15, 20, 20, 20]), Projection([null, 2, 8, 14]), Ideal([null, 2, 11, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(2.5)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 17May16"])
            }
        );
    });

    it('no planned end and zero max days after planned end set: no end date line, no end date info in subtitle, chart ends at today', function () {
        expectCalculation(chartData("2016-05-10", 4, [
            InProgress([0, 4, 3, 2]),
            Completed([0, 0, 5, 4]),
            Accepted([0, 0, 2, 8]),
            Scope([10, 15, 20, 20])
        ]), {
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16'],
                series: [InProgress([4, 3, 2]), Completed([0, 5, 4]), Accepted([0, 2, 8]), Scope([15, 20, 20]), Projection([null, 2, 8])]
            }, {
                xAxis: {plotLines: [todayLine(2)]},
                subtitle: subtitle(["Projected End: 17May16"])
            }
        );
    });

    it('no planned end and non-zero max days after planned end set: chart extended to show whole projection', function () {
        expectCalculation(chartData("2016-05-10", 4, [
            InProgress([0, 4, 3, 2]),
            Completed([0, 0, 5, 4]),
            Accepted([0, 0, 2, 8]),
            Scope([10, 15, 20, 20])
        ]), {
            maxDaysAfterTargetDate: 10,
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16', '17May16'],
                series: [InProgress([4, 3, 2]), Completed([0, 5, 4]), Accepted([0, 2, 8]), Scope([15, 20, 20, 20, 20]), Projection([null, 2, 8, 14, 20])]
            }, {
                xAxis: {plotLines: [todayLine(2), projectedEndLine(4)]},
                subtitle: subtitle(["Projected End: 17May16"])
            }
        );
    });

    it('no planned end and non-zero max days after planned end set and today is not the latest in series: chart looks like today was the latest in series', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 4, 4]),
            Accepted([0, 0, 2, 8, 8]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            maxDaysAfterTargetDate: 10,
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16', '17May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 4, null]), Accepted([0, 2, 8, null]), Scope([15, 20, 20, 20, 20]), Projection([null, 2, 8, 14, 20])]
            }, {
                xAxis: {plotLines: [todayLine(2), projectedEndLine(4)]},
                subtitle: subtitle(["Projected End: 17May16"])
            }
        );
    });

    it('no planned end and not enough max days after planned end set to show whole projection: chart extended to show only the days set', function () {
        expectCalculation(chartData("2016-05-10", 4, [
            InProgress([0, 4, 3, 2]),
            Completed([0, 0, 5, 4]),
            Accepted([0, 0, 2, 8]),
            Scope([10, 15, 20, 20])
        ]), {
            maxDaysAfterTargetDate: 1,
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, 2]), Completed([0, 5, 4]), Accepted([0, 2, 8]), Scope([15, 20, 20, 20]), Projection([null, 2, 8, 14])]
            }, {
                xAxis: {plotLines: [todayLine(2)]},
                subtitle: subtitle(["Projected End: 17May16"])
            }
        );
    });

    it('no planned end and only one accepted value: no projection, latest day is today', function () {
        expectCalculation(chartData("2016-05-10", 3, [
            InProgress([0, 4, 3]),
            Completed([0, 0, 5]),
            Accepted([0, 0, 2]),
            Scope([10, 15, 20])
        ]), {
            today: new Date("2016-05-12")
        }).toReturn({
                categories: ['11May16', '12May16'],
                series: [InProgress([4, 3]), Completed([0, 5]), Accepted([0, 2]), Scope([15, 20])]
            }, {
                xAxis: {plotLines: [todayLine(1)]},
                subtitle: subtitle()
            }
        );
    });

    it('no change in accepted: projection not drawn', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 10, 7]),
            Accepted([0, 0, 2, 2, 5]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 10, null]), Accepted([0, 2, 2, null]), Scope([15, 20, 20, 20]), Ideal([null, 2, 11, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(2)]},
                subtitle: subtitle(["Planned End: 16May16"])
            }
        );
    });

    it('after end date and not completed: series after end date rendered, chart extended to show whole projection, ideal line with no change', function () {
        expectCalculation(chartData("2016-05-10", 6, [
            InProgress([0, 4, 3, 2, 2, 1]),
            Completed([0, 0, 5, 4, 3, 2]),
            Accepted([0, 0, 2, 8, 12, 17]),
            Scope([10, 15, 20, 20, 20, 20])
        ]), {
            maxDaysAfterTargetDate: 10,
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-17")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16', '17May16', '18May16'],
                series: [InProgress([4, 3, 2, 2, 1]), Completed([0, 5, 4, 3, 2]), Accepted([0, 2, 8, 12, 17]), Scope([15, 20, 20, 20, 20, 20]), Projection([null, 2, 7, 12, 17, 22]), Ideal([null, 2, 11, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(4), projectedEndLine(5)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 18May16"])
            }
        );
    });

    it('after end date and completed: no projection line and label', function () {
        expectCalculation(chartData("2016-05-10", 6, [
            InProgress([0, 4, 3, 2, 0, 0]),
            Completed([0, 0, 5, 4, 2, 0]),
            Accepted([0, 0, 2, 12, 18, 20]),
            Scope([10, 15, 20, 20, 20, 20])
        ]), {
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-17")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16', '17May16'],
                series: [InProgress([4, 3, 2, 0, 0]), Completed([0, 5, 4, 2, 0]), Accepted([0, 2, 12, 18, 20]), Scope([15, 20, 20, 20, 20]), Ideal([null, 2, 11, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(4)]},
                subtitle: subtitle(["Planned End: 16May16"])
            }
        );
    });

    it('progress better than ideal: projection line is not drawn above total estimation', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 7, 7]),
            Accepted([0, 2, 12, 19, 19]),
            Scope([10, 15, 20, 20, 20])
        ]), {
            targetDate: new Date("2016-05-16"),
            today: new Date("2016-05-12")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, null, null]), Completed([0, 5, null, null]), Accepted([2, 12, null, null]), Scope([15, 20, 20, 20]), Projection([2, 12, 22]), Ideal([2, 8, 14, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(1), projectedEndLine(2)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 13May16"])
            }
        );
    });
});
