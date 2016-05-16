function expectCalculation(data, calcConfig) {
    return {
        toReturn: function (expectedData, expectedChartConfig) {
            console.log(JSON.stringify(data));

            var actualChartConfig = Ext.create("My.BurnUpCalculation").calculate(data, calcConfig);
            expect(data.categories).toEqual(expectedData.categories, "in categories");
            var i;
            for (i = 0; i < expectedData.series.length; i++) {
                expect(expectedData.series[i]).toEqual(data.series[i], "in expected series <" + expectedData.series[i].name + ">");
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
    return {text: parts.join(" &nbsp;&nbsp;&nbsp; "), useHTML: true};
}

function plannedEndLine(index) {
    return {value: index, color: '#000', width: 2, label: {text: 'planned end'}};
}

function todayLine(index) {
    return {value: index, color: '#AAA', width: 2, label: {text: 'today'}, dashStyle: 'ShortDash'};
}

var IDEAL = [0, 6 + 2 / 3, 13 + 1 / 3, 20];

describe('Calculation for chart', function () {
    it('typical case: series when work not yet started removed, points in future zeroed', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 7, 7]),
            Accepted([0, 0, 0, 5, 5]),
            Planned([10, 15, 20, 20, 20])
        ]), {
            endDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 7, null]), Accepted([0, 0, 5, null]), Planned([15, 20, 20, 20]), Projection([0, 2.5, 5, 7.5]), Ideal(IDEAL)]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(2)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 23May16"])
            }
        );
    });

    it('today is weekend: today line drawn between Friday and Monday', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 7, 7]),
            Accepted([0, 0, 0, 5, 5]),
            Planned([10, 15, 20, 20, 20])
        ]), {
            endDate: new Date("2016-05-16"),
            today: new Date("2016-05-14")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 7, null]), Accepted([0, 0, 5, null]), Planned([15, 20, 20, 20]), Projection([0, 2.5, 5, 7.5]), Ideal(IDEAL)]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(2.5)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 23May16"])
            }
        );
    });

    it('no planned end: no end date line and no end date info rendered', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 7, 7]),
            Accepted([0, 0, 0, 5, 5]),
            Planned([10, 15, 20, 20, 20])
        ]), {
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 7, null]), Accepted([0, 0, 5, null]), Planned([15, 20, 20, 20]), Projection([0, 2.5, 5, 7.5])]
            }, {
                xAxis: {plotLines: [plannedEndLine(-1), todayLine(2)]},
                subtitle: subtitle(["Projected End: 23May16"])
            }
        );
    });

    it('no accepted: projection not drawn', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 7, 7]),
            Accepted([0, 0, 0, 0, 0]),
            Planned([10, 15, 20, 20, 20])
        ]), {
            endDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, 2, null]), Completed([0, 5, 7, null]), Accepted([0, 0, 0, null]), Planned([15, 20, 20, 20]), Ideal(IDEAL)]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(2)]},
                subtitle: subtitle(["Planned End: 16May16"])
            }
        );
    });

    it('after end date: series after end date and projection normally rendered, ideal line with no change', function () {
        expectCalculation(chartData("2016-05-10", 6, [
            InProgress([0, 4, 3, 2, 2, 2]),
            Completed([0, 0, 5, 7, 7, 7]),
            Accepted([0, 0, 0, 5, 5, 6]),
            Planned([10, 15, 20, 20, 20, 20])
        ]), {
            endDate: new Date("2016-05-16"),
            today: new Date("2016-05-17")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16', '17May16'],
                series: [InProgress([4, 3, 2, 2, 2]), Completed([0, 5, 7, 7, 7]), Accepted([0, 0, 5, 5, 6]), Planned([15, 20, 20, 20, 20]), Projection([0, 1.5, 3, 4.5, 6]), Ideal(IDEAL)]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(4)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 30May16"])
            }
        );
    });

    it('no InProgress in first non-zero column: shows that projection is calculated from zero at first logged work to last accepted', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 0, 0, 2, 2]),
            Completed([0, 0, 5, 7, 7]),
            Accepted([0, 0, 0, 5, 5]),
            Planned([10, 15, 20, 20, 20])
        ]), {
            endDate: new Date("2016-05-16"),
            today: new Date("2016-05-13")
        }).toReturn({
                categories: ['12May16', '13May16', '16May16'],
                series: [InProgress([0, 2, null]), Completed([5, 7, null]), Accepted([0, 5, null]), Planned([20, 20, 20]), Projection([0, 5, 10]), Ideal([0, 10, 20])]
            }, {
                xAxis: {plotLines: [plannedEndLine(2), todayLine(1)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 18May16"])
            }
        );
    });

    it('progress better than ideal: projection line is not drawn above total estimation', function () {
        expectCalculation(chartData("2016-05-10", 5, [
            InProgress([0, 4, 3, 2, 2]),
            Completed([0, 0, 5, 7, 7]),
            Accepted([0, 0, 12, 19, 19]),
            Planned([10, 15, 20, 20, 20])
        ]), {
            endDate: new Date("2016-05-16"),
            today: new Date("2016-05-12")
        }).toReturn({
                categories: ['11May16', '12May16', '13May16', '16May16'],
                series: [InProgress([4, 3, null, null]), Completed([0, 5, null, null]), Accepted([0, 12, null, null]), Planned([15, 20, 20, 20]), Projection([0, 12, 24]), Ideal(IDEAL)]
            }, {
                xAxis: {plotLines: [plannedEndLine(3), todayLine(1)]},
                subtitle: subtitle(["Planned End: 16May16", "Projected End: 13May16"])
            }
        );
    });
});
