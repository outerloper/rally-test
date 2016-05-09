Ext.define("MilestoneBurnup", Ext.merge({
    extend: "Rally.app.App",
    componentCls: "app",

    getSettingsFields: function () {
        return [{
            name: "milestone",
            xtype: "mymilestonecombobox"
        }];
    },

    getMilestoneId: function () {
        return this.getSetting("milestone");
    },

    getProjectId: function () {
        return this.getContext().getProject().ObjectID;
    },

    launch: function () {
        Ext.define("MyMilestoneBomboBox", {
            xtype: 'rallymilestonecombobox',
            extend: "Rally.ui.combobox.MilestoneComboBox",
            alias: "widget.mymilestonecombobox",
            editable: false,
            noEntryText: "-- choose a milestone --",
            allowNoEntry: true
        });

        this.getDataForChart().then({
            success: function (chartSetup) {
                this.add(Ext.merge(this.createChart(), chartSetup));
            },
            failure: function (error) {
                console.error("Unable to fetch chart data: ", error);
            },
            scope: this
        });
    },

    burnupCalculator: Ext.define("My.MilestoneBurnUpCalculator", {
        extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

        getMetrics: function () {
            return [
                {
                    field: "PlanEstimate",
                    as: "In Progress",
                    f: "filteredSum",
                    filterField: "ScheduleState",
                    filterValues: ["In-Progress"],
                    display: "column"
                },
                {
                    field: "PlanEstimate",
                    as: "Completed",
                    f: "filteredSum",
                    filterField: "ScheduleState",
                    filterValues: ["Completed"],
                    display: "column"
                },
                {
                    field: "PlanEstimate",
                    as: "Accepted",
                    f: "filteredSum",
                    filterField: "ScheduleState",
                    filterValues: ["Accepted", "Released"],
                    display: "column"
                },
                {
                    field: "PlanEstimate",
                    as: "Planned",
                    f: "sum",
                    display: "line"
                }
            ];
        },

        runCalculation: function (snapshots, snapshotsToSubtract) {
            var data = this.callParent(arguments);
            this.postProcessCalculation(data);
            return data;
        },

        postProcessCalculation: function (data) {
            this.chartConfig = {};
            this.stripFutureBars(data);
            this.addPlotLines(data);
            this.addProjection(data);
            this.addSubtitle();
        },

        today: new Date(),

        /**
         * @param {Object} data
         *  {
         *      series: [
         *          {name: "Planned", data: [12, 14, 14, 15, ...] }, ...
         *      ],
         *      categories: ["2016-03-28", "2016-03-29", ...]
         *  }
         */
        stripFutureBars: function (data) {
            var currentIndex = this.findDateIndex(data, this.today) + 1;
            data.series.forEach(function (series) {
                if (series.name != "Planned") {
                    for (var i = currentIndex; i < series.data.length; i++) {
                        series.data[i] = null;
                    }
                }
            });
        },

        addPlotLines: function (data) {
            this.chartConfig.xAxis = this.chartConfig.xAxis || {};
            this.chartConfig.xAxis.plotLines = [
                {
                    value: this.findDateIndex(data, this.endDate),
                    color: "#000", width: 2, label: {text: "planned end"}
                },
                {
                    value: this.findDateIndex(data, this.today, true),
                    color: "#AAA", width: 2, label: {text: "today"}, dashStyle: "ShortDash"
                }
            ];
        },

        addProjection: function (data) {
            var currentIndex = this.findDateIndex(data, this.today);
            var actualStartIndex = currentIndex;
            data.series.forEach(function (series) {
                if (series.name != "Planned") {
                    for (var i = 0; i < series.data.length; i++) {
                        if (series.data[i] > 0 && i < actualStartIndex) {
                            actualStartIndex = i;
                        }
                    }
                }
            });
            var currentAccepted = this.getSeries(data, "Accepted")[currentIndex];

            if (actualStartIndex >= 0 && currentAccepted > 0 && actualStartIndex < currentIndex) {
                var projectionStep = currentAccepted / (currentIndex - actualStartIndex);
                var projection = data.categories.reduce(function (projection, value, index) {
                    if (index <= actualStartIndex) {
                        projection.push(index == actualStartIndex ? 0 : null);
                    } else {
                        projection.push((projection[index - 1] || 0) + projectionStep);
                    }
                    return projection;
                }, []);

                data.series.push({
                    name: "Projection",
                    data: projection,
                    type: "line",
                    dashStyle: "Dash",
                    marker: {enabled: false},
                    enableMouseTracking: false,
                    lineWidth: 1
                });

                var currentPlanned = this.getSeries(data, "Planned")[currentIndex];
                var daysRemaining = (currentPlanned - currentAccepted) / projectionStep;
                this.projectedEndDate = Rally.util.DateTime.add(this.today, "day", daysRemaining);
            }
        },

        addSubtitle: function () {
            var parts = [];
            if (this.endDate) {
                parts.push("Planned End: " + formatDate(this.endDate));
            }
            if (this.projectedEndDate) {
                parts.push("Projected End: " + formatDate(this.projectedEndDate));
            }
            this.chartConfig.subtitle = {text: parts.join(" &nbsp;&nbsp;&nbsp; "), useHTML: true};
        },

        findDateIndex: function (data, date, floating) {
            var searchedDateString = (date instanceof Date) ? dateToIsoString(date) : date;
            for (var i = 0; i < data.categories.length; i++) {
                var dateString = data.categories[i];
                if (dateString >= searchedDateString) {
                    return dateString > searchedDateString ? i - (floating ? 0.5 : 1) : i;
                }
            }
            return -1;
        },

        getSeries: function (data, name) {
            var series = data.series.find(function (aSeries) {
                return aSeries.name == name;
            });
            return series ? series.data : [];
        }
    }),

    createChart: function () {
        return Ext.create("Rally.ui.chart.Chart", {
            chartColors: ["#AEC", "#8FCD88", "#5EAC00", "#005EB8", "#000"],
            chartConfig: {
                title: {text: "Milestone"},
                chart: {zoomType: "xy"},
                xAxis: {
                    title: {text: "Date"},
                    labels: {
                        maxStaggerLines: 1,
                        step: 5,
                        formatter: function () {
                            return formatDate(this.value);
                        }
                    }
                },
                yAxis: {
                    title: {text: "Points"}
                },
                plotOptions: {
                    line: {
                        marker: {enabled: true}
                    },
                    column: {
                        stacking: true
                    },
                    area: {
                        stacking: true,
                        marker: {enabled: false}
                    }
                }
            },

            listeners: {
                snapshotsAggregated: function (chart) {
                    Ext.merge(chart.chartConfig, chart.calculator.chartConfig);
                }
            }
        });
    },

    getDataForChart: function () {
        return Deft.Promise.all([
            Rally.data.ModelFactory.getModel({
                type: "Milestone"
            }),
            this.getMilestoneId()
        ]).then({
            success: function (modelAndId) {
                var model = modelAndId[0];
                var id = modelAndId[1];
                return id ? model.load(id) : rejectedPromise("No milestone set");
            },
            scope: this
        }).then({
            success: function (milestone) {
                var context = {project: this.getProjectId() ? "/" + "project" + "/" + this.getProjectId() : null};
                var filter = Rally.data.wsapi.Filter.fromQueryString("(Milestones.ObjectID contains " + milestone.getId() + ")");
                return Deft.Promise.all(
                    ["Defect", "HierarchicalRequirement", "PortfolioItem/TeamFeature"].map(function (artifactType) {
                        var deft = Ext.create('Rally.data.wsapi.Store', {
                            model: artifactType,
                            filters: filter,
                            fetch: ["ObjectID"],
                            context: context,
                            autoLoad: true
                        }).load();
                        return deft;
                    })
                ).then({
                    success: function (results) {
                        var artifactIds = results.reduce(function (result, records) {
                            return result.concat(records.map(function (record) {
                                return +record.raw.ObjectID;
                            }));
                        }, []);
                        return this.getConfigForChart(artifactIds, milestone);
                    },
                    scope: this
                });
            },
            scope: this
        });
    },

    getConfigForChart: function (artifactIds, milestone) {
        var storeConfig = {
            listeners: {
                load: function (store, data, success) {
                    // dev && console.debug(dev.rallyDataToString(data, ["_ValidFrom", "_ValidTo", "FormattedID", "PlanEstimate", "ScheduleState"]));
                }
            },
            find: {
                _ProjectHierarchy: this.projectId,
                _TypeHierarchy: {$in: ["Defect", "HierarchicalRequirement"]},
                _ItemHierarchy: {$in: artifactIds},
                Children: null
            },
            fetch: ["PlanEstimate", "ScheduleState", "FormattedID"],
            hydrate: ["ScheduleState"],
            sort: {_ValidFrom: 1}, // 1 = ASC
            limit: Infinity
        };

        return {
            calculatorType: "My.MilestoneBurnUpCalculator",
            calculatorConfig: {
                endDate: milestone.get("TargetDate")
            },

            storeType: "Rally.data.lookback.SnapshotStore",
            storeConfig: storeConfig,

            exceptionHandler: loggingSnapshotStoreExceptionHandler,

            chartConfig: {
                title: {text: milestone.get("Name")}
            }
        };
    }
}, dev ? dev.app : null));

