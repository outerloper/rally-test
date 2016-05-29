Ext.define("MilestoneBurnupWithProjection", Ext.merge({
    extend: "Rally.app.App",
    componentCls: "app",

    getSettingsFields: function () {
        var LABEL_WIDTH = 170;
        var LABEL_ALIGN = "right";
        return [
            {name: "milestone", xtype: "mymilestonecombobox"},
            {name: "customStartDate", xtype: "rallydatefield", label: "Custom Chart Start Date", config: {labelWidth: LABEL_WIDTH, labelAlign: LABEL_ALIGN}},
            {name: "customProjectionStartDate", xtype: "rallydatefield", label: "Custom Projection Start Date", config: {labelWidth: LABEL_WIDTH, labelAlign: LABEL_ALIGN}},
            {name: "maxDaysAfterPlannedEnd", xtype: "rallynumberfield", label: "Max Days Shown After Planned End", config: {labelWidth: LABEL_WIDTH, labelAlign: LABEL_ALIGN, minValue: 0, maxValue: 250}}
        ];
    },

    config: {
        defaultSettings: {
            maxDaysAfterPlannedEnd: 30
        }
    },

    getMilestoneId: function () {
        return this.getSetting("milestone");
    },

    getProjectId: function () {
        return this.getContext().getProject().ObjectID;
    },

    launch: function () {
        Ext.define("MyMilestoneComboBox", {
            extend: "Rally.ui.combobox.MilestoneComboBox",
            alias: "widget.mymilestonecombobox",
            editable: false,
            config: {
                labelText: "Milestone",
                hideLabel: false
            }
        });

        this.getDataForChart().then({
            success: function (chartSetup) {
                this.add(Ext.merge(this.createChart(), chartSetup));
            },
            failure: function (error) {
                var lines = ["Unable to fetch data. Click the gear and check your App Settings."];
                if (error && error.error && error.error.errors) {
                    lines = lines.concat(error.error.errors);
                } else {
                    lines.push(error);
                }
                this.add({xtype: "container", html: lines.join("<br/>"), componentCls: "center"});
            },
            scope: this
        });
    },

    burnupCalculator: Ext.define("My.MilestoneBurnUpCalculator", {
        extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",
        mixins: ["My.BurnUpCalculation"],

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
            this.chartConfig = this.calculate(data, this.calculationConfig);
            return data;
        }
    }),

    createChart: function () {
        return Ext.create("Rally.ui.chart.Chart", {
            chartColors: ["#AEC", "#8FCD88", "#5EAC00", "#005EB8", "#000", "#000"],
            chartConfig: {
                title: {text: "Milestone"},
                chart: {zoomType: "xy"},
                xAxis: {
                    title: {text: "Date"},
                    labels: {
                        maxStaggerLines: 1,
                        step: 5
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
            success: function (milestoneModelAndId) {
                var model = milestoneModelAndId[0];
                var id = milestoneModelAndId[1];
                return id ? model.load(id) : rejectedPromise("No milestone set");
            },
            scope: this
        }).then({
            success: function (milestone) {
                var context = {project: this.getProjectId() ? "/project/" + this.getProjectId() : null};
                var filter = Rally.data.wsapi.Filter.fromQueryString("(Milestones.ObjectID contains " + milestone.getId() + ")");
                return Deft.Promise.all(
                    ["Defect", "HierarchicalRequirement", "PortfolioItem/TeamFeature"].map(function (artifactType) {
                        return Ext.create('Rally.data.wsapi.Store', {
                            model: artifactType,
                            filters: filter,
                            fetch: ["ObjectID"],
                            context: context,
                            autoLoad: true
                        }).load();
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
                    // dev && console.debug(dev.storeDataToString(data, ["_ValidFrom", "_ValidTo", "FormattedID", "PlanEstimate", "ScheduleState"]));
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
                endDate: milestone.get("TargetDate"),
                calculationConfig: {
                    endDate: milestone.get("TargetDate"),
                    customStartDate: this.getSetting("customStartDate"),
                    customProjectionStartDate: this.getSetting("customProjectionStartDate"),
                    maxDaysAfterPlannedEnd: this.getSetting("maxDaysAfterPlannedEnd")
                }
            },

            storeType: "Rally.data.lookback.SnapshotStore",
            storeConfig: storeConfig,

            exceptionHandler: loggingSnapshotStoreExceptionHandler,
            queryErrorMessage: "No work items found for milestone <strong>" + milestone.get("Name") + "</strong>.",

            chartConfig: {
                title: {text: milestone.get("Name")}
            }
        };
    }
}, dev ? dev.app : null));

