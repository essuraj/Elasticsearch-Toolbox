var gs;
app.controller('MainController', ['$scope', '$http', 'ESService', function($scope, $http, $ess) {
    $scope.Title = "elasticsearch toolbox";
    $scope.qfieldTemp = [];
    gs = $scope;
   
    $scope.connectToES = function(url) {
        Materialize.toast('Connecting to elasticsearch', 500);
        $ess.getIndexes(url).then(function(stat) {
            Materialize.toast('Connected to elasticsearch', 3000, 'green');
            $scope.indexes = Object.keys(stat.data.indices);
            $scope.esStat = stat.data;
            $scope.isConnected = true;
        });
    };

    $scope.changeIndex = function(es) {
        $scope.indexInfo = $scope.indexes[es.selectedIndex];
        var url = String.format("{0}/{1}", es.url, es.selectedIndex);
        $ess.getMappings(url)
            .then(function(response) {
                console.log("Mappings", response);
                $scope.Mappings = response;

                $scope.allMappings = [];
                var mappingsObj = (response[Object.keys(response)]).mappings;
                $scope.MappingList = Object.keys(mappingsObj);

                $.each($scope.MappingList, function(k, v) {
                    $scope.allMappings = $scope.allMappings.concat(Object.keys(mappingsObj[v].properties));
                });
            });

    };
    $scope.changeMapping = function(es) {

        var props = Object.keys($scope.Mappings[es.selectedIndex].mappings[es.selectedMapping].properties);
        $scope.allMappings = props;

    };
    $scope.formatQuery = function () {
        CodeMirror.commands["selectAll"](queryEditor);
        var range = {
            from: queryEditor.getCursor(true),
            to: queryEditor.getCursor(false)
        };
        queryEditor.autoFormatRange(range.from, range.to);
        CodeMirror.commands["singleSelection"](queryEditor);
    };
    $scope.addToQuery = function(esQ) {
        if (esQ == undefined || Object.keys(esQ).length != 4) {
            Materialize.toast('You need to fill in all the fields', 3000, 'orange darken-4');
        } else {
            if (esQ.condition.length > 0 && esQ.field.length > 0 && esQ.fieldValue.length > 0 && esQ.qType.length > 0) {
                $scope.qfieldTemp.push(esQ);
                $scope.esQ = {};
            } else {
                Materialize.toast('You need to fill in all the fields', 3000, 'orange darken-4');
            }
        }


    };
    $scope.execute = function(es) {
        if (!es.selectedIndex) {
            Materialize.toast('Select an index', 3000, 'orange');
            $('#index').removeClass('shake').removeClass('animated').addClass('shake').addClass('animated');
            return;
        }

        var queryString = '';
        var queryObj = '';
        if ($scope.settings.useEditor)
        {
            queryString = queryEditor.getValue();
        } else {
            var queryObj = BuildQuery($scope.qfieldTemp)
            queryString = JSON.stringify(queryObj)
        }
       
        console.debug(queryString);

        var url = String.format("{0}/{1}/_search", es.url, es.selectedIndex);

        $ess.executeQuery(url, queryString)
            .then(function(response) {
                console.log("Q Result", response);
                $scope.Output = response;
                queryEditor.setValue(queryString);
                resultEditor.setValue(JSON.stringify(response, null, 2));
                setTimeout(function () {

                    resultEditor.refresh();
                    queryEditor.refresh();
                }, 1);
                $('ul.tabs').tabs('select_tab', 'res');
            });
    };

    $scope.saveSettings = function(settings) {
        resultEditor.setOption("theme", settings.theme);
        queryEditor.setOption("theme", settings.theme);
        setTimeout(function () {
            resultEditor.refresh();
            queryEditor.refresh();
        }, 1);
        if (settings)
            chrome.storage.sync.set({
                'settings': settings
            }, function() {
                Materialize.toast('Settings saved', 3000, 'green');
            });
    };
}]);

function BuildQuery(queryParams) {
    var queryTemplate = $.parseJSON(queryEditor.getValue());

    //Adding selected fields
    var jQfields = $('.fields:checked');
    var fields = [];
    $.each(jQfields, function(k, field) {
        fields.push($(field).prop('name'));
    });
    if (fields.length > 0)
        queryTemplate.fields = fields;

    //Adding Query Params
    queryTemplate.query.bool = GetQuery(queryParams);

    return queryTemplate;
}

function GetQuery(queryParams) {
    var groups = {};
    var mustList = [],
        mustNotList = [],
        shouldList = [];
    $.each(queryParams, function(i, esQ) {

        switch (esQ.condition) {
            case "must":
                {
                    mustList.push(QueryObjGenerator(esQ.qType, esQ.field, esQ.fieldValue));
                    break;
                }
            case "must_not":
                {
                    mustNotList.push(QueryObjGenerator(esQ.qType, esQ.field, esQ.fieldValue));
                    break;
                }
            case "should":
                {
                    shouldList.push(QueryObjGenerator(esQ.qType, esQ.field, esQ.fieldValue));
                    break;
                }
            default:
                {
                    throw "";
                }
        }

    });

    return {
        "must": mustList,
        "must_not": mustNotList,
        "should": shouldList
    };

}

function QueryObjGenerator(type, field, value) {
    var objStr = "";
    if (type == "query_string") {
        objStr = '{"' + type + '":{"default_field":"' + field + '","query":"' + value + '"}}';

    } else {
        objStr = '{"' + type + '":{"' + field + '":"' + value + '"}}';
    }
    var json = $.parseJSON(objStr);
    console.log(type, json);
    return json;
}
