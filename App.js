Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {
        this.iterationCombobox = this.add({
            xtype: 'rallyiterationcombobox',
            listeners: {
                ready: this._onIterationComboboxLoad,
                select: this._onIterationComboboxChanged,
                scope: this
            }
        });
    },

    _onIterationComboboxLoad: function() {
        var addNewConfig = {
            xtype: 'rallyaddnew',
            recordTypes: ['User Story', 'Defect'],
            ignoredRequiredFields: ['Name', 'ScheduleState', 'Project'],
            showAddWithDetails: false,
            listeners: {
                beforecreate: this._onBeforeCreate,
                scope: this
            }
        };

        this.addNew = this.add(addNewConfig);

        var cardBoardConfig = {
            xtype: 'rallycardboard',
            types: ['Defect', 'User Story'],
            attribute: 'ScheduleState',
            storeConfig: {
                filters: [this.iterationCombobox.getQueryFromSelected()]
            }
        };
        this.cardBoard = this.add(cardBoardConfig);
    },

    _onBeforeCreate: function(addNewComponent, record) {
        record.set('Iteration', this.iterationCombobox.getValue());
    },

    _onIterationComboboxChanged: function() {
        var config = {
            storeConfig: {
                filters: [this.iterationCombobox.getQueryFromSelected()]
            }
        };

        this.cardBoard.refresh(config);
    }
});
