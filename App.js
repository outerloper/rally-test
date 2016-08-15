Ext.define("MilestoneBurnupWithProjection", Ext.merge({
    extend: "Rally.app.App",
    componentCls: "app",

    setContextTimebox: function (timeboxScope) {
        this._timeboxFromScope = timeboxScope && timeboxScope.getRecord();
    },

    getContextTimebox: function () {
        if (!this._timeboxFromScope) {
            this.setContextTimebox(this.getContext().getTimeboxScope());
        }
        return this._timeboxFromScope;
    },

    getSettingsFields: function () {
        var milestones = this.getSetting("milestones");
        var defaultConfig = {labelWidth: 170, labelAlign: "right"};
        var checkboxConfig = {labelWidth: 360};
        var currentProjectText = "-- Current Project --";
        var contextTimebox = this.getContextTimebox();
        var settingsFields = [];
        settingsFields.push({ // be careful changing options here, this combo should allow no selection, one and multiple selections and storing previous state for all of these cases
            name: "milestones",
            label: "Milestone(s)",
            xtype: "rallymilestonecombobox",
            editable: false,
            multiSelect: true,
            allowNoEntry: true,
            emptyText: "-- Choose --",
            hideLabel: false,
            autoSelect: false,
            disabled: getRallyRecordType(contextTimebox) == "milestone",
            forceSelection: "string" != typeof milestones || milestones.indexOf(",") < 0 // workaround for bug (?) in combo when multiple selection is not repopulated
        });

        settingsFields.push({html: "<h3>Additional options</h3>", xtype: "label"});
        settingsFields.push({
            name: "project",
            label: "Project",
            xtype: "rallyprojectcombobox", // this is private component but works for now and is much convenient than the public one
            allowBlank: true,
            allowClear: true,
            clearText: currentProjectText,
            emptyText: currentProjectText, // all those 4 allow/blank/cleat/text options are required for "Current project" option working smoothly for user
            listeners: {
                ready: function (comp) { // hack in validation to allow empty value meaning "Current project"
                    var originalValidator = comp.validator;
                    comp.validator = function (value) {
                        if (currentProjectText == value) {
                            value = "";
                            this.setValue(value);
                        }
                        return !value || originalValidator.call(this, value);
                    };
                }
            }
        });
        settingsFields.push({name: "customStartDate", xtype: "rallydatefield", label: "Ignore data until...", config: defaultConfig});
        settingsFields.push({name: "customTrendStartDate", xtype: "rallydatefield", label: "Custom Trend line start", config: defaultConfig});
        settingsFields.push({
            name: "maxDaysAfterPlannedEnd",
            xtype: "rallynumberfield",
            label: "Max days to show after Planned End date",
            config: Ext.merge(Ext.clone(defaultConfig), {minValue: 0, maxValue: 250})
        });
        // disabled for now, not sure if needed
        //settingsFields.push({name: "customTitle", xtype: "textfield", label: "Custom chart title", config: Ext.merge({}, defaultConfig, {width: 400})});
        settingsFields.push({name: "projectTargetPage", xtype: "textfield", label: "When clicking on project name go to page...", config: defaultConfig});
        settingsFields.push({
            name: "markAuxDates",
            xtype: "rallycheckboxfield",
            label: "This checkbox enables marking auxiliary dates on the chart. Specify such dates in the Milestone's Notes field - e.g.<br/>'2017-05-14 Code Complete', each entry in separate line.",
            config: checkboxConfig
        });
        settingsFields.push({name: "smallDisplay", xtype: "rallycheckboxfield", label: "Adjust chart to small display", config: checkboxConfig});
        return settingsFields;
    },

    config: {
        defaultSettings: {
            maxDaysAfterPlannedEnd: 45,
            markAuxDates: true,
            projectTargetPage: "iterationstatus"
        }
    },

    getMilestoneIds: function () {
        if (getRallyRecordType(this.getContextTimebox()) == "milestone") {
            return [this.getContextTimebox()];
        }
        var milestones = this.getSetting("milestones");
        return milestones ? milestones.split(",") : [];
    },

    getReleaseId: function () {
        var timebox = this.getContextTimebox();
        if (getRallyRecordType(timebox) == "release") {
            return timebox || this.getSetting("release");
        }
        return null;
    },

    getProjectId: function () {
        var project = this.getSetting("project");
        if (project) {
            return getRallyIdFromRef(project, "project");
        }
        return this.getContext().getProject().ObjectID;
    },

    setDataLoading: function (loading) {
        this.setLoading(this.dataLoaded ? false : loading);
    },

    setDataLoaded: function (loaded) {
        this.dataLoaded = loaded;
        this.setLoading(false);
    },

    layout: "fit",

    launch: function () {
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
                this.add({itemId: "chart", xtype: "container", html: lines.join("<br/>"), componentCls: "center"});
            },
            scope: this
        });
    },

    onTimeboxScopeChange: function (timeboxScope) {
        var timebox = timeboxScope.getRecord();
        var timeboxType = getRallyRecordType(timebox);
        if (timeboxType == "milestone" || timeboxType == "release") {
            this.setContextTimebox(timeboxScope);
            var settings = {};
            if (timeboxType == "milestone") {
                settings.milestones = [timebox.get("_ref")];
            } else {
                settings.release = timebox.get("_ref");
            }
            Rally.data.PreferenceManager.update({
                appID: this.getAppId(),
                settings: settings
            });
            this.remove("chart");
            this.setDataLoaded(false);
            this.launch();
        }
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
            itemId: "chart",
            chartColors: ["#B4F4D9", "#9FDDA7", "#6DBD44", app.scopeColor, "#000", "#000"], // in progress, compeleted, accepted, planned, trend, ideal
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
                    title: {text: "Points"},
                    minRange: 10,
                    min: 0
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
            }),
            !this.getProjectId("project") ? this.getProjectId() : Rally.data.ModelFactory.getModel({type: "Project"}).then({
                success: function (model) {
                    return model.load(this.getProjectId());
                },
                scope: this
            }),
            Ext.create("Rally.data.wsapi.Store", {
                model: "Iteration",
                fetch: ["StartDate", "EndDate"],
                filters: Rally.data.wsapi.Filter.fromQueryString("((StartDate <= today) AND (EndDate >= today))")
            }).load()
        ]).then({
            success: function (contextItems) {
                var milestones = contextItems[0];
                var release = contextItems[1];
                this.project = contextItems[2];
                this.ensureColorsForMilestones(milestones);
                if (!release && milestones.length === 0) {
                    return rejectedPromise("No milestone specified. Set milestone or release filter in your page settings or choose milestone in your app settings.");
                }
                this.iteration = contextItems[3][0];
                this.velocity = release && release.get("PlannedVelocity") ? {text: release.get("Name") + " Planned Velocity", value: release.get("PlannedVelocity")} : null;
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
                    iteration: this.iteration,
                    velocity: this.velocity,
                    auxDates: this.getAuxDates(milestones, release),
                    customStartDate: this.getSetting("customStartDate"),
                    customTrendStartDate: this.getSetting("customTrendStartDate"),
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

    ensureColorsForMilestones: function (milestones) {
        if (milestones) {
            milestones.forEach(function (milestone) {
                if (!milestone.get("DisplayColor")) {
                    milestone.set("DisplayColor", "#888888");
                }
            });
        }
    },


    getPlannedEndDate: function (milestones, release) {
        var app = this;
        var latestMilestoneDate = null;
        milestones.forEach(function (milestone) {
            var date = milestone.get("TargetDate");
            if (!latestMilestoneDate || date && date > latestMilestoneDate) {
                latestMilestoneDate = date;
                app.scopeColor = milestone.get("DisplayColor");
            }
        });
        if (!app.scopeColor) {
            app.scopeColor = "#D42";
        }
        return !latestMilestoneDate && release ? release.get("ReleaseDate") : latestMilestoneDate;
    },

    getAuxDates: function (milestones, release) {
        var result = {};
        var app = this;
        milestones.forEach(function (milestone) {
            if (app.getSetting("markAuxDates")) {
                milestone.get("Notes").split(/<\/?[^>]+>/g).map(function (html) {
                    return html.trim().match(/(\d\d\d\d-\d\d-\d\d)\W+(\w.*)/);
                }).forEach(function (matches) {
                    if (matches && !isNaN(Date.parse(matches[1]))) {
                        result[matches[1]] = matches[2];
                    }
                });
            }
            if (milestone.get("TargetDate")) {
                result[dateToIsoString(milestone.get("TargetDate"))] = milestoneIcon(milestone) + " " + milestone.get("Name");
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
            joinNotEmpty([
                release ? formatRelease(release, context) : null,
                milestones.map(function (milestone) {
                    return formatMilestone(milestone, context);
                }).join(", ")
            ], ": "),
            formatProject(this.project, this.getSetting("projectTargetPage"))
        ], " &mdash; ");
    }
}, dev ? dev.app : null));

