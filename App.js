window.dev = window.dev || undefined;

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
        var defaultConfig = {width: 400, labelWidth: 210, labelAlign: "right"};
        var checkboxConfig = {labelWidth: 380};
        var currentProjectText = "-- Current Project --";
        var contextTimebox = this.getContextTimebox();
        var settingsFields = [];
        settingsFields.push({ // be careful changing options here, this combo should allow no selection, one and multiple selections and storing previous state for all of these cases
            name: "milestones",
            label: "Milestone(s)",
            xtype: "rallymilestonecombobox",
            editable: true,
            multiSelect: true,
            allowNoEntry: true,
            emptyText: "-- Choose --",
            hideLabel: false,
            autoSelect: false,
            disabled: getRallyRecordType(contextTimebox) == "milestone",
            forceSelection: "string" != typeof milestones || milestones.indexOf(",") < 0 // workaround for a bug (?) in combo when multiple selection is not repopulated
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
            },
            config: defaultConfig
        });
        settingsFields.push({name: "teamFeatures", xtype: "textfield", label: "Take only these Team Features: (IDs)", config: defaultConfig});
        settingsFields.push({name: "customStartDate", xtype: "rallydatefield", label: "Ignore data until:", config: defaultConfig});
        settingsFields.push({name: "customTrendStartDate", xtype: "rallydatefield", label: "Start projection lines from:", config: defaultConfig});
        settingsFields.push({
            name: "maxDaysAfterTargetDate",
            xtype: "rallynumberfield",
            label: "Max days to show after Target Date",
            config: Ext.merge(Ext.clone(defaultConfig), {minValue: 0, maxValue: 250})
        });
        settingsFields.push({
            name: "capacityPlan",
            xtype: "textarea",
            label: "Model projection lines with a specific capacity plan (provide average daily capacity values separated by the dates when they change &ndash; <abbr title='" +
            "To express that team capacity is 3 before September, in September&#013;it is going to be doubled and later it is to be 2.5, you would write:&#013;&#013;3 2018-09-01 6 2018-10-01 2.5'>example</abbr>)",
            height: 55,
            config: defaultConfig
        });
        settingsFields.push({name: "projectTargetPage", xtype: "textfield", label: "When clicking on a project name, open this page:", config: defaultConfig});
        settingsFields.push({
            name: "markAuxDates",
            xtype: "rallycheckboxfield",
            label: "Mark additional key dates on the chart (such dates must be specified in the Milestone's Notes field &ndash; <abbr title='" +
            "To express that your Code Complete date is on Dec 10&#013;and RC Build is planned on Jan 15, you would write:&#013;&#013;2018-12-10 Code Complete&#013;2019-01-15 RC Build'>example</abbr>)",
            config: checkboxConfig
        });
        settingsFields.push({
            name: "drawIterations",
            xtype: "rallycheckboxfield",
            label: "Draw iteration boundaries on chart's background",
            config: checkboxConfig
        });
        settingsFields.push({
            name: "displayWidth",
            xtype: "combobox",
            label: "Display width %, decrease it to fix chart look in a small display area",
            store: Ext.create('Ext.data.Store', {
                fields: ['value'],
                data: [{value: 100}, {value: 50}, {value: 30}]
            }),
            queryMode: "local",
            displayField: "value",
            valueField: "value",
            config: defaultConfig,
            validator: function (value) {
                if (isNaN(value)) {
                    return "Number expected";
                }
                var MIN = 20, MAX = 200;
                if (value < MIN || value > MAX) {
                    return "Value out of allowed range (" + MIN + "-" + MAX + ")";
                }
                return true;
            }
        });
        settingsFields.push({
            name: "debug",
            xtype: "rallycheckboxfield",
            label: "Debug mode (prints diagnostic information in JavaScript console)",
            config: checkboxConfig
        });
        return settingsFields;
    },

    config: {
        defaultSettings: {
            maxDaysAfterTargetDate: 45,
            markAuxDates: true,
            projectTargetPage: "iterationstatus",
            displayWidth: 100,
            drawIterations: true
        }
    },

    getMilestoneIds: function () {
        if (getRallyRecordType(this.getContextTimebox()) === "milestone") {
            return [this.getContextTimebox()];
        }
        var milestones = this.getSetting("milestones");
        return milestones ? milestones.split(",") : [];
    },

    getProjectId: function () {
        var project = this.getSetting("project");
        if (project) {
            return getRallyIdFromRef(project, "project");
        }
        return this.getContext().getProject().ObjectID;
    },

    getTeamFeatureIds: function () {
        var teamFeatures = this.getSetting("teamFeatures");
        if (!teamFeatures) {
            return [];
        }
        return teamFeatures.toString().split(/\s*[,;\s]\s*/).map(function (id) {
            return id.match(/^\d+$/) ? "TF" + id : id.toUpperCase();
        });
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
        if (timeboxType === "milestone") {
            this.setContextTimebox(timeboxScope);
            var settings = {milestones: [timebox.get("_ref")]};
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
                    metric("Accepted", ["Accepted", "Released-to-Production"]),
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
            chartColors: ["#B4F4D9", "#9FDDA7", "#6DBD44", app.scopeColor, "#000", "#000"], // in progress, completed, accepted, planned, trend, ideal
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
        var teamFeatureIds = this.getTeamFeatureIds();
        return promiseAll([
            this.getMilestoneIds().length === 0 ? [] : Rally.data.ModelFactory.getModel({type: "Milestone"}).then({
                success: function (model) {
                    return promiseAll(this.getMilestoneIds().map(function (id) {
                        return model.load(id);
                    }));
                },
                scope: this
            }),
            !this.getProjectId() ? this.getProjectId() : Rally.data.ModelFactory.getModel({type: "Project"}).then({
                success: function (model) {
                    return model.load(this.getProjectId());
                },
                scope: this
            }),
            teamFeatureIds.length === 0 ? [] : Ext.create("Rally.data.wsapi.Store", {
                model: "PortfolioItem/TeamFeature",
                filters: Rally.data.wsapi.Filter.fromQueryString(chainedExpression("OR", teamFeatureIds.map(function (id) {
                    return "FormattedID = " + id;
                }))),
                scope: this
            }).load(),
            Ext.create("Rally.data.wsapi.Store", {
                model: "Iteration",
                fetch: ["StartDate", "EndDate"],
                filters: Rally.data.wsapi.Filter.fromQueryString("((StartDate <= today) AND (EndDate >= today))")
            }).load()
        ]).then({
            success: function (contextItems) {
                try {
                    this.capacityPlan = parseCapacityPlan(this.getSetting("capacityPlan"));
                } catch (error) {
                    return rejectedPromise("The following problem found in the Capacity Plan definition: <strong>" + error + "</strong>. " +
                        "Please correct the app settings:<pre>" + this.getSetting("capacityPlan") + "</pre>");
                }
                var milestones = contextItems[0];
                this.project = contextItems[1];
                this.ensureColorsForMilestones(milestones);
                if (milestones.length === 0) {
                    return rejectedPromise("No milestone specified. Set milestone filter in your page settings or choose milestone in the app settings.");
                }
                this.teamFeatures = contextItems[2];
                if (this.teamFeatures.length === 0 && teamFeatureIds.length > 0) {
                    return rejectedPromise("None of the Team Features specified in the app settings, ID: <strong>" + teamFeatureIds.join(", ") + "</strong>, " +
                        "exist in this project. Please correct the app settings or change the project.");
                }
                this.iteration = contextItems[3][0];
                var query = chainedExpression("OR", milestones.map(function (milestone) {
                    return "Milestones.ObjectID contains " + milestone.getId();
                }));
                var filter = Rally.data.wsapi.Filter.fromQueryString(query);
                var context = {project: this.getProjectId() ? "/project/" + this.getProjectId() : null};
                return promiseAll(
                    this.getArtifactTypes(teamFeatureIds).map(function (artifactType) {
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
                        var artifactIds = [].concat.apply([], results).map(function (record) {
                            return +record.raw.ObjectID;
                        });
                        return this.getConfigForChart(artifactIds, milestones, this.teamFeatures);
                    },
                    scope: this
                });
            },
            scope: this
        });
    },

    getArtifactTypes: function () {
        var result = ["HierarchicalRequirement"];
        if (this.getTeamFeatureIds().length === 0) {
            result.push("PortfolioItem/TeamFeature", "Defect");
        }
        return result;
    },

    getConfigForChart: function (artifactIds, milestones, teamFeatures) {
        var teamFeatureIds = teamFeatures.map(function (teamFeature) {
            return +teamFeature.get("ObjectID");
        });
        var query = {
            _ProjectHierarchy: this.projectId,
            _TypeHierarchy: {$in: ["Defect", "HierarchicalRequirement"]},
            _ItemHierarchy: {$in: artifactIds},
            Children: null
        };
        if (teamFeatureIds.length > 0) {
            query.ObjectID = {$in: artifactIds};
            query._ItemHierarchy = {$in: teamFeatureIds};
        }
        var fetchFields = ["_ValidFrom", "_ValidTo", "ObjectID", "FormattedID", "PlanEstimate", "ScheduleState"];
        var debug = this.getSetting("debug");
        var storeConfig = {
            listeners: {
                load: function (store, data, success) {
                    if (debug) {
                        console.debug("[DEBUG] Data snapshots for chart START:");
                        console.debug(storeDataToString(data, fetchFields));

                        console.debug("[DEBUG] Query for list of all stories:");
                        console.debug(workItemQuery(data, function (item) {
                            return isUserStory(item);
                        }));
                        console.debug("[DEBUG] Query for list of all defects:");
                        console.debug(workItemQuery(data, function (item) {
                            return isDefect(item);
                        }));

                        console.debug("[DEBUG] Query for list of not accepted stories:");
                        console.debug(workItemQuery(data, function (item) {
                            return isUserStory(item) && !isAccepted(item);
                        }));
                        console.debug("[DEBUG] Query for list of not accepted defects:");
                        console.debug(workItemQuery(data, function (item) {
                            return isDefect(item) && !isAccepted(item);
                        }));
                    }
                }
            },
            find: query,
            fetch: fetchFields,
            hydrate: ["ScheduleState"],
            compress: true,
            sort: {_ValidFrom: 1}, // 1 = ASC
            limit: Infinity,
            removeUnauthorizedSnapshots: true,
            useHttpPost: true
        };

        var today = new Date();
        var targetDate = this.getTargetDate(milestones);
        var maxDaysAfterTargetDate = this.getSetting("maxDaysAfterTargetDate");
        var endDate = targetDate;
        if (!targetDate) {
            endDate = today;
        } else if (today > targetDate) {
            var maxEndDate = addBusinessDays(targetDate, maxDaysAfterTargetDate);
            endDate = today > maxEndDate ? today : maxEndDate;
        }
        return {
            calculatorType: "My.MilestoneBurnUpCalculator",
            calculatorConfig: {
                endDate: endDate,
                calculationConfig: {
                    targetDate: targetDate,
                    iteration: this.iteration,
                    capacityPlan: this.capacityPlan,
                    auxDates: this.getAuxDates(milestones),
                    drawIterations: this.getSetting("drawIterations"),
                    customStartDate: this.getSetting("customStartDate"),
                    customTrendStartDate: this.getSetting("customTrendStartDate"),
                    maxDaysAfterTargetDate: maxDaysAfterTargetDate,
                    displayWidth: this.getSetting("displayWidth")
                }
            },

            storeType: "Rally.data.lookback.SnapshotStore",
            storeConfig: storeConfig,

            exceptionHandler: loggingSnapshotStoreExceptionHandler,
            queryErrorMessage: "No work items found for <strong>" + this.getChartTitle(milestones, teamFeatures) + "</strong>.",

            chartConfig: {
                title: {text: this.getChartTitle(milestones, teamFeatures), useHTML: true}
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


    getTargetDate: function (milestones) {
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
        return latestMilestoneDate;
    },

    getAuxDates: function (milestones) {
        var result = {};
        var app = this;
        milestones.forEach(function (milestone) {
            if (app.getSetting("markAuxDates")) {
                milestone.get("Notes").split(/<\/?[^>]+>/g).map(function (html) {
                    return html.trim().match(/^(\d\d\d\d-\d\d?-\d\d?)\W+(\w.*)$/);
                }).forEach(function (matches) {
                    if (matches && !isNaN(Date.parse(matches[1]))) {
                        result[matches[1]] = matches[2].length <= 20 ? matches[2] : matches[2].substring(0, 20).trim() + "...";
                    }
                });
            }
            if (milestones.length > 1 && milestone.get("TargetDate")) {
                result[dateToIsoString(milestone.get("TargetDate"))] = milestoneIcon(milestone) + milestone.get("Name");
            }
        });
        return result;
    },

    getChartTitle: function (milestones, teamFeatures) {
        var context = this.getContext();
        var title = milestones.map(function (milestone) {
            return formatMilestone(milestone, context);
        }).join(", ");
        if (teamFeatures && teamFeatures.length > 0) {
            title += ": " + teamFeatures.map(function (teamFeature) {
                    return formatTeamFeature(teamFeature, context);
                }).join(", ");
        }
        return title + " &mdash; " + formatProject(this.project, this.getSetting("projectTargetPage"));
    }
}, dev ? dev.app : null));
