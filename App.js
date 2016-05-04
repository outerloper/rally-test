Ext.define("CustomApp", {
    extend: "Rally.app.App",
    componentCls: "app",

    stateful: true,

    getState: function () {
        var value = this.milestonePicker.getValue();
        this.milestoneId = value ? +value.replace("/milestone/", "") : null;
        state = {
            milestoneId: this.milestoneId
        };
        console.log("current state:", state); // DEBUG
        return state;
    },

    applyState: function (state) {
        if (state) {
            this.milestoneId = state.milestoneId;
            console.log("loading state:", state); // DEBUG
        } else {
            console.log("No state to restore:", state); // DEBUG
        }
    },

    launch: function () {
        function handleMilestoneSelection(app) {
            var value = app.milestonePicker.getValue();
            app.milestoneId = value ? +value.replace("/milestone/", "") : null;
            if (app.milestoneId) {
                console.log("saving state..."); // DEBUG
                app.saveState();
            }
            app.drawChart();
        }

        this.milestonePicker = this.add({
            xtype: 'rallymilestonecombobox',
            cls: 'milestone-for-chart',
            editable: false,
            noEntryText: '-- choose a milestone --',
            allowNoEntry: true,
            listeners: {
                select: function () {
                    handleMilestoneSelection(this);
                },
                ready: function () {
                    if (this.milestoneId) {
                        this.milestonePicker.setValue("/milestone/" + this.milestoneId);
                    }
                    handleMilestoneSelection(this);
                    this.milestonePicker.ready = true;
                },
                scope: this
            }
        });
    },

    burnupCalculator: Ext.define("Sabre.MilestoneBurnUpCalculator", {
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
        }
    }),

    drawChart: function () {
        if (!this.milestoneId) {
            return;
        }
        var storeConfig = {
            listeners: {
                load: function (store, data, success) {
                    debug(rallyDataToString(data, ["_ValidFrom", "_ValidTo", "PlanEstimate", "ScheduleState"]));
                }
            },
            find: {
                //_ProjectHierarchy: avpsProjectId('fleet'),
                _ProjectHierarchy: this.getContext().getProject().ObjectID,
                _TypeHierarchy: {$in: ["Defect", "HierarchicalRequirement"]},
                Milestones: {$in: [this.milestoneId]},
                Children: null
            },
            fetch: ["PlanEstimate", "ScheduleState"],
            hydrate: ["ScheduleState"],
            sort: {_ValidFrom: 1}
        };

        if (this.chart) {
            this.remove(this.chart);
        }
        this.chart = Ext.create("Rally.ui.chart.Chart", {
            calculatorType: "Sabre.MilestoneBurnUpCalculator",
            calculatorConfig: {},

            storeType: "Rally.data.lookback.SnapshotStore",
            storeConfig: storeConfig,

            chartColors: ["#AEC", "#8FCD88", "#5EAC00", "#005EB8"],
            chartConfig: {
                title: { text: ""},
                chart: {zoomType: "xy"},
                xAxis: {title: {text: "Date"}},
                yAxis: {title: {text: "Points"}},
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
            }
        });
        this.add(this.chart);
    }
});
