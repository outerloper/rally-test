Ext.define("MilestoneBurnupWithProjection", Ext.merge({
    extend: "Rally.app.App",
    componentCls: "app",

    getContextTimebox: function () {
        if (!this._timeboxFromScope) {
            var timeboxScope = this.getContext().getTimeboxScope();
            this._timeboxFromScope = timeboxScope && timeboxScope.getRecord();
        }
        return this._timeboxFromScope;
    },

    getSettingsFields: function () {
        var defaultConfig = {labelWidth: 170, labelAlign: "right"};
        var checkboxConfig = {labelWidth: 360};
        var settingsFields = [
            {name: "customStartDate", xtype: "rallydatefield", label: "Custom chart Start Date", config: defaultConfig},
            {name: "customTrendStartDate", xtype: "rallydatefield", label: "Custom Start Date for Trend ", config: defaultConfig},
            {
                name: "maxDaysAfterPlannedEnd",
                xtype: "rallynumberfield",
                label: "Max days to show after Planned End",
                config: Ext.merge(Ext.clone(defaultConfig), {minValue: 0, maxValue: 250})
            },
            {name: "customTitle", xtype: "textfield", label: "Custom Chart Title", config: Ext.merge({}, defaultConfig, {width: 400})},
            {
                name: "markAuxDates",
                xtype: "checkboxfield",
                label: "This checkbox enables marking custom dates on the chart. Such dates can be specified in the Notes field of the Milestone - e.g. '2017-05-14 Code Freeze', each entry in separate line.",
                config: checkboxConfig
            },
            {name: "smallDisplay", xtype: "checkbox", label: "Adjust chart to small display", config: checkboxConfig}
        ];
        var contextTimebox = this.getContextTimebox();
        if (getRallyRecordType(contextTimebox) != "milestone") {
            settingsFields.unshift({name: "milestone", label: "Milestone (multi-select)", xtype: "mymilestonecombobox"});
        }
        return settingsFields;
    },

    config: {
        defaultSettings: {
            maxDaysAfterPlannedEnd: 40,
            markAuxDates: true
        }
    },

    getMilestoneIds: function () {
        if (getRallyRecordType(this.getContextTimebox()) == "milestone") {
            return [this.getContextTimebox()];
        }
        var milestones = this.getSetting("milestone");
        return milestones ? milestones.split(",") : [];
    },

    getReleaseId: function () {
        if (getRallyRecordType(this.getContextTimebox()) == "release") {
            return this.getContextTimebox();
        }
        return this.getSetting("release");
    },

    getProjectId: function () {
        return this.getContext().getProject().ObjectID;
    },

    setDataLoading: function (loading) {
        this.setLoading(this.dataLoaded ? false : loading);
    },

    setDataLoaded: function () {
        this.dataLoaded = true;
        this.setLoading(false);
    },

    layout: "fit",

    launch: function () {
        Ext.define("MyMilestoneComboBox", {
            extend: "Rally.ui.combobox.MilestoneComboBox",
            alias: "widget.mymilestonecombobox",
            editable: false,
            config: {
                multiSelect: true,
                allowNoEntry: true,
                emptyText: "-- All milestones --",
                defaultToCurrentItem: false,
                hideLabel: false
            }
        });

        this.getDataForChart().then({
            success: function (chartSetup) {
                this.add(Ext.merge(this.createChart(), chartSetup));
            },
            failure: function (error) {
                this.setDataLoaded();
                var lines = ["Unable to fetch data."];
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

    listeners: {
        boxready: function (app) {
            app.setDataLoading(true);
        },

        ready: function (app) {
            app.defineCalculator();
        }
    },

    defineCalculator: function () {
        function metric(label, values) {
            return {
                as: label,
                f: "filteredSum",
                field: "PlanEstimate",
                filterField: "ScheduleState",
                filterValues: values,
                display: "column"
            };
        }
        Ext.define("My.MilestoneBurnUpCalculator", {
            extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",
            mixins: ["My.BurnUpCalculation"],

            getMetrics: function () {
                return [
                    metric("In Progress", ["In-Progress"]),
                    metric("Completed", ["Completed"]),
                    metric("Accepted", ["Accepted", "Released"]),
                    {as: "Scope", f: "sum", field: "PlanEstimate", display: "line"}
                ];
            },

            runCalculation: function (snapshots, snapshotsToSubtract) {
                var data = this.callParent(arguments);
                this.chartConfig = this.calculate(data, this.calculationConfig);
                return data;
            }
        });
    },

    createChart: function () {
        var app = this;
        return Ext.create("Rally.ui.chart.Chart", {
            chartColors: ["#B4F4D9", "#9FDDA7", "#6DBD44", app.scopeColor || "#005EB8", "#000", "#000"], // in progress, compeleted, accepted, planned, trend, ideal
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
                        marker: {enabled: false},
                        lineWidth: 4
                    },
                    column: {
                        pointPadding: 0,
                        groupPadding: 0.15,
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
                },

                storesLoaded: function () {
                    app.setLoading(false);
                }
            }
        });
    },

    getDataForChart: function () {
        return promiseAll([
            this.getMilestoneIds().length === 0 ? [] : Rally.data.ModelFactory.getModel({type: "Milestone"}).then({
                success: function (model) {
                    return promiseAll(this.getMilestoneIds().map(function (id) {
                        return model.load(id);
                    }));
                },
                scope: this
            }),
            !this.getReleaseId() ? null : Rally.data.ModelFactory.getModel({type: "Release"}).then({
                success: function (model) {
                    return model.load(this.getReleaseId());
                },
                scope: this
            })
        ]).then({
            success: function (timeboxes) {
                var milestones = timeboxes[0];
                var release = timeboxes[1];
                if (!release && milestones.length === 0) {
                    return rejectedPromise("No milestone specified. Set milestone or release filter in your page settings or choose milestone in your app settings.");
                }
                var query = joinNotEmpty([
                    joinNotEmpty(milestones.map(function (milestone) {
                        return "(Milestones.ObjectID contains " + milestone.getId() + ")";
                    }), " OR ", "(", ")"),
                    release ? "(Release.ObjectID = " + release.getId() + ")" : null
                ], " AND ", "(", ")");
                var filter = Rally.data.wsapi.Filter.fromQueryString(query);
                var context = {project: this.getProjectId() ? "/project/" + this.getProjectId() : null};
                return promiseAll(
                    ["PortfolioItem/TeamFeature", "HierarchicalRequirement", "Defect"].map(function (artifactType) {
                        return Ext.create('Rally.data.wsapi.Store', {
                            model: artifactType,
                            filters: filter,
                            fetch: ["ObjectID", "Milestones", "Parent", "PortfolioItem"],
                            context: context,
                            autoLoad: true,
                            limit: Infinity
                        }).load();
                    })
                ).then({
                    success: function (results) {
                        var artifactIds = [].concat(results[0], results[1], results[2]).map(function (record) {
                            return +record.raw.ObjectID;
                        });
                        return this.getConfigForChart(artifactIds, milestones, release);
                    },
                    scope: this
                });
            },
            scope: this
        });
    },

    getConfigForChart: function (artifactIds, milestones, release) {
        var storeConfig = {
            listeners: {
                load: function (store, data, success) {
                    // printStoreData(data, ["_ValidFrom", "_ValidTo", "FormattedID", "PlanEstimate", "ScheduleState"]);
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
            limit: Infinity,
            removeUnauthorizedSnapshots: true,
            useHttpPost: true
        };

        var today = new Date();
        var plannedEndDate = this.getPlannedEndDate(milestones, release);
        var maxDaysAfterPlannedEnd = this.getSetting("maxDaysAfterPlannedEnd");
        var endDate = plannedEndDate;
        if (!plannedEndDate) {
            endDate = today;
        } else if (today > plannedEndDate) {
            var maxEndDate = addBusinessDays(plannedEndDate, maxDaysAfterPlannedEnd);
            endDate = today > maxEndDate ? maxEndDate : today;
        }
        return {
            calculatorType: "My.MilestoneBurnUpCalculator",
            calculatorConfig: {
                endDate: endDate,
                calculationConfig: {
                    maxEndDate: endDate,
                    plannedEndDate: plannedEndDate,
                    auxDates: this.getAuxDates(milestones, release),
                    customStartDate: this.getSetting("customStartDate"),
                    customProjectionStartDate: this.getSetting("customTrendStartDate"),
                    maxDaysAfterPlannedEnd: maxDaysAfterPlannedEnd,
                    smallDisplay: this.getSetting("smallDisplay")
                }
            },

            storeType: "Rally.data.lookback.SnapshotStore",
            storeConfig: storeConfig,

            exceptionHandler: loggingSnapshotStoreExceptionHandler,
            queryErrorMessage: "No work items found for <strong>" + this.getChartTitle(milestones, release) + "</strong>.",

            chartConfig: {
                title: {text: this.getChartTitle(milestones, release), useHTML: true}
            }
        };
    },

    getPlannedEndDate: function (milestones, release) {
        var app = this;
        var result = null;
        milestones.forEach(function (milestone) {
            var date = milestone.get("TargetDate");
            if (!result || date && date > result) {
                result = date;
                app.scopeColor = milestone.get("DisplayColor") || this.scopeColor;
            }
        });
        return !result && release ? release.get("ReleaseDate") : result;
    },

    getAuxDates: function (milestones, release) {
        var result = {};
        var app = this;
        milestones.forEach(function (milestone) {
            if (app.getSetting("markAuxDates")) {
                milestone.get("Notes").split(/<\/?\w+>/g).map(function (html) {
                    return html.trim().match(/(\d\d\d\d-\d\d-\d\d)\W+(\w.*)/);
                }).forEach(function (matches) {
                    if (matches && !isNaN(Date.parse(matches[1]))) {
                        result[matches[1]] = matches[2];
                    }
                });
            }
            if (milestone.get("TargetDate")) {
                result[dateToIsoString(milestone.get("TargetDate"))] = milestone.get("Name");
            }
        });
        if (release) {
            if (release.get("ReleaseDate")) {
                result[dateToIsoString(release.get("ReleaseDate"))] = release.get("Name");
            }
        }
        return result;
    },

    getChartTitle: function (milestones, release) {
        var customTitle = this.getSetting("customTitle");
        if (customTitle) {
            return customTitle;
        }
        var context = this.getContext();
        return joinNotEmpty([
            release ? formatRelease(release, context) : null,
            milestones.map(function (milestone) {
                return formatMilestone(milestone, context);
            }).join(", ")
        ], ": ");
    }
}, dev ? dev.app : null));

