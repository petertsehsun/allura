'use strict';


/**
 * Gets the current url.
 * @constructor
 * @param {bool} rest - Return a "rest" version of the url.
 * @returns {string}
 */
function _getProjectUrl(rest = true) {
    var [nbhd, proj] = window.location.pathname.split('/').slice(1, 3);
    var base = `${window.location.protocol}//${window.location.host}`;
    return rest ? `${base}/rest/${nbhd}/${proj}/` : `${base}/${nbhd}/${proj}/`;
}

/**
 * Get a tool label from a NavBarItem node.
 * @constructor
 * @param {NavBarItem} node - Return a "rest" version of the url.
 * @returns {string}
 */
function getLabel(node) {
    return node.props.children.props.children.props.name;
}

var ToolsPropType = {
    name: React.PropTypes.string.isRequired,
    url: React.PropTypes.string.isRequired,
    isSubmenu: React.PropTypes.bool,
    tools: React.PropTypes.arrayOf(
        React.PropTypes.shape({
            ordinal: React.PropTypes.number,
            mount_point: React.PropTypes.string,
            name: React.PropTypes.string,
            url: React.PropTypes.string,
            is_anchored: React.PropTypes.bool,
            tool_name: React.PropTypes.string,
            icon: React.PropTypes.string
        })
    ).isRequired
};

/**
 * A NavBar link, the most basic component of the NavBar.
 * @constructor
 */
var NavLink = React.createClass({
    propTypes: {
        name: React.PropTypes.string.isRequired,
        url: React.PropTypes.string.isRequired,
        style: React.PropTypes.object
    },
    render: function () {
        var classes = this.props.subMenu ? ' subMenu' : '';
        classes += this.props.classes;
        return (
            <a href={ this.props.url } key={ `link-${_.uniqueId()}` } className={ classes } style={ this.props.style }>
                { this.props.name }
            </a> // jshint ignore:line
        );
    }
});

/**
 * When the number of tools of the same type exceeds the grouping threshold,
 * they are placed in a group and this submenu is generated.
 * @constructor
 */
var ToolSubMenu = React.createClass({
    propTypes: {
        isSubmenu: React.PropTypes.bool,
        tools: ToolsPropType
    },
    handle: '.draggable-handle',
    mode: 'list',
    render: function () {
        var _this = this;
        var subMenuClass = this.props.isSubmenu ? ' submenu ' : '';
        var tools = this.props.tools.map(function (item, i) {
            return (
                <div className={ 'draggable-element ' + subMenuClass } key={ 'draggable-' + _.uniqueId() }>
                    <div className='draggable-handle' key={ 'handleId-' + _.uniqueId() }>
                        <NavBarItem {..._this.props} data={ item } name={ item.mount_point } url={ item.url } data-id={ i }/>
                    </div>
                </div>
            );
        });

        return (
            <div className='hidden' style={ {  display: 'none'} }>
                <ReactReorderable handle='.draggable-handle' mode='grid' onDragStart={ this.onDragStart } onDrop={ this.props.onToolReorder }
                                  onChange={ this.onChange }>
                    { tools }
                </ReactReorderable>
            </div>
        );
    }
});

/**
 * A single NavBar item. (A wrapper for NavLink).
 * @constructor
 */
var NavBarItem = React.createClass({
    propTypes: {
        name: React.PropTypes.string.isRequired,
        url: React.PropTypes.string.isRequired,
        isSubmenu: React.PropTypes.bool,
        tools: ToolsPropType
    },
    generateLink: function () {
        return <NavLink url={ this.props.url } name={ this.props.name } key={ _.uniqueId() }/>;
    },

    generateSubmenu: function () {
        return <ToolSubMenu {...this.props} tools={ this.props.data.children } key={ `submenu-${_.uniqueId()}` } isSubmenu={ true }/>;
    },

    generateContent: function () {
        var content = [this.generateLink()];
        if (this.props.data.children) {
            content.push(this.generateSubmenu());
        }

        return content;
    },

    render: function () {
        var content = this.generateContent();
        var classes = this.props.editMode ? 'tb-item tb-item-edit' : 'tb-item';
        classes = this.props.is_anchored ? `${classes} anchored` : classes;

        return (
            <div className={ classes }>
                { content }
            </div>
        );
    }
});

/**
 * An input component that updates the NavBar's grouping threshold.
 * @constructor
 */
var GroupingThreshold = React.createClass({
    propTypes: {
        initialValue: React.PropTypes.number.isRequired
    },
    getInitialState: function () {
        return {
            value: this.props.initialValue
        };
    },

    handleChange: function (event) {
        this.setState({
            value: event.target.value
        });
        this.props.onUpdateThreshold(event);
    },

    render: function () {
        return (
            <div>
                { !!this.props.isHidden &&
                <div id='threshold-config'>
            <span>
              <label htmlFor='threshold-input'>Grouping Threshold</label>
                <input type='number' name='threshold-input' className='tooltip'
                       title='Number of tools allowed before grouping.'
                       value={ this.state.value }
                       onChange={ this.handleChange }
                       min='1' max='10'/>
              </span>
                </div> }
            </div>
        );
    }
});


/**
 * The NavBar when in "Normal" mode.
 * @constructor
 */
var NormalNavBar = React.createClass({
    buildMenu: function (item) {
        var classes = ` ui-icon-${item.icon}-32`;
        classes = item.is_anchored ? `${classes} anchored` : classes;

        var subMenu;
        if (item.children) {
            subMenu = item.children.map(this.buildMenu);
        }

        return (
            <li>
                <a href={ item.url } key={ 'link-' + _.uniqueId() } className={ classes }>
                    { item.name }
                </a>
                <ul className={ item.children ? 'submenu' : '' }>
                    { subMenu }
                </ul>
            </li>
        );
    },

    render: function () {
        var listItems = this.props.items.map(this.buildMenu);
        var classes = 'dropdown';
        classes = this.props.isSubmenu ? classes += ' submenu' : classes;
        return (
            <ul className={ classes } key={ `toolList-${_.uniqueId()}` }>
                { listItems }
            </ul>
        );
    }
});

/**
 * The NavBar when in "Admin" mode.
 * @constructor
 */
var AdminNav = React.createClass({
    propTypes: {
        name: React.PropTypes.string.isRequired,
        url: React.PropTypes.string.isRequired,
        isSubmenu: React.PropTypes.bool,
        tools: ToolsPropType
    },
    handle: '.draggable-handle',
    mode: 'grid',
    getInitialState: function () {
        return {
            hover: false
        };
    },

    mouseOver: function () {
        this.setState({
            hover: true
        });
    },

    mouseOut: function () {
        this.setState({
            hover: false
        });
    },

    render: function () {
        var _this = this;
        var subMenuClass = this.props.isSubmenu ? ' submenu ' : '';
        var tools = this.props.tools.map(function (item, i) {
            return (
                <div className={ 'draggable-element' + subMenuClass } key={ 'draggable-' + _.uniqueId() }>
                    <div className='draggable-handle' key={ 'handleId-' + _.uniqueId() }>
                        <NavBarItem onMouseOver={ _this.mouseOver } onMouseOut={ _this.mouseOut } {..._this.props} data={ item }
                                    name={ item.mount_point } url={ item.url }
                                    key={ 'tb-item-' + _.uniqueId() } is_anchored={ item.is_anchored } data-id={ i }/>
                    </div>
                </div>
            );
        });

        return (
            <div className='react-drag edit-mode'>
                <ReactReorderable key={ 'reorder-' + _.uniqueId() } handle='.draggable-handle' mode='grid' onDragStart={ this.onDragStart }
                                  onDrop={ this.props.onToolReorder } onChange={ this.onChange }>
                    { tools }
                </ReactReorderable>
            </div>
        );
    }
});

/**
 * The button that toggles NavBar modes.
 * @constructor
 */
var ToggleAdminButton = React.createClass({
    propTypes: {
        visible: React.PropTypes.bool
    },
    render: function () {
        var classes = this.props.visible ? 'fa fa-unlock' : 'fa fa-lock';
        return (
            <button id='toggle-admin-btn' onClick={ this.props.handleButtonPush } className='admin-toolbar-right'>
                <i className={ classes }></i>
            </button>
        );
    }
});

//////////////////
// Add New Tool //
//////////////////

var NewToolButton = React.createClass({
    render: function () {
        return (
            <button id='new-tool-btn' onClick={ this.props.handleAddButton } className=''>
                <i className={ classes }></i>
            </button>
        );
    }
});


/**
 * Menu for adding a new tool.
 * @constructor
 */
var NewToolMenu = React.createClass({
    propTypes: {
        tools: React.PropTypes.array,
        onPushAddButton: React.PropTypes.func,
        onSetActive: React.PropTypes.func,
        formData: React.PropTypes.object,
        visible: React.PropTypes.bool
    },

    render: function () {
        var _this = this;

        var tools = this.props.tools.map(function (tool, i) {
            var classes;
            if (_this.props.active && _this.props.active.name === tool.name) {
                classes = " selected-tool"
            }
            else {
                classes = ""
            }
            return (
                <li className={classes}
                    id={"add-new-" + tool.name}
                    key={`new-tool-btn-${i}`}
                    onClick={_this.props.handleChangeTool}>
                    {tool.name}
                </li>
            )
        });

        return (
            <div className="tool-card">
                <div className="box-title">Add a new tool
                </div>
                <div id="installable-items">
                    <ul className="installable-tool-box">
                        {tools}
                    </ul>
                </div>
                <div className="tool-partition"></div>
                <NewToolInfo {...this.props}
                    name={this.props.active.name}
                    description={this.props.active.description}
                    handleAddButton={this.props.handleAddButton}/>
            </div>
        );
    }
});

var InstallNewToolForm = React.createClass({
    render: function () {
        console.log(this.props.active.name);
        if (this.props.active.name === "Add a tool"){

            return(<div></div>);
        }
        var default_mount_point = this.props.active.defaults.default_mount_point;
        var default_mount_label = this.props.active.defaults.default_mount_label;

        return (
            <form id="add-tool-form">
                <label htmlFor="mount_label">Label</label>
                <input id="mount_label" onChange={this.props.handleChangeForm} value={default_mount_label} />

                <label htmlFor="mount_point">Url Path</label>
                <input id="mount_point"
                       onChange={this.props.handleChangeForm}
                       onBlur={this.props.validateMountPoint}
                       value={this.props.formData.mount_point}/>

                <p style={{"color": "grey"}}><small>http://hs/p/finna/</small><strong style={{"color": "orange"}}>
                    {this.props.formData.mount_point}
                </strong></p>

                <button id="new-tool-submit"
                        onClick={this.props.handleAddButton}
                        className="add-tool-button">
                    Add Tool
                </button>
            </form>
        );
    }
});


var NewToolInfo = React.createClass({
    propTypes: {
        name: React.PropTypes.string,
        description: React.PropTypes.description,
        handleAddButton: React.PropTypes.func
    },


    render: function () {
        return (
            <div className="tool-info">
                <div className="tool-info-left">
                    <h1>{this.props.name}</h1>
                    <p>{this.props.description}</p>
                </div>
                <div className="tool-info-right">
                    <InstallNewToolForm {...this.props} />
                </div>
            </div>
        );
    }
});

var NewToolMain = React.createClass({
    getInitialState: function () {
        let toolPlaceHolder = {
            name: "Add a tool",
            description: "click on one of the tools shown above to add it to your project."
        };

        return {
            installableTools: [toolPlaceHolder],
            active: toolPlaceHolder,
            new_tool: {
                mount_point: "",
                mount_label: ""
            }
        };
    },


    componentDidMount: function () {
        let _this = this;
        $.get(_getProjectUrl(true) + "/admin/installable_tools/", function (result) {
            if (this.isMounted()) {
                console.log('hit is mounted', result['tools']);
                this.setState({
                    installableTools: result['tools']
                });
            }
        }.bind(this));
    },
    handleAddButton: function (e) {
        e.preventDefault();
        console.log('Add new too button pushed');
        console.log('e.target.name', e);
        console.log(e.target.textContent);

    },
    handleChangeTool: function (e) {
        console.log(`Changed tool to: ${e.target.textContent}`);
        this._setActiveByName(e.target.textContent);

    },
    _setActiveByName: function (name) {
        var index = this.state.installableTools.findIndex(
            x => x.name === name
        );
        this.setState({
            active: this.state.installableTools[index]
        });
    },

    handleChangeForm: function (e) {
        console.log(e.target.value);
        var _new_tool = this.state.new_tool;

        console.log(e.target.id);
        _new_tool[e.target.id] = e.target.value;

        this.setState({
            new_tool: _new_tool
        });

    },
    handleSubmit: function (e) {
        e.preventDefault();
        var nextItems = this.state.items.concat([this.state.text]);
        var nextText = '';
        this.setState({items: nextItems, text: nextText});
    },

    validateMountPoint: function (e) {
        e.preventDefault();
        let url = _getProjectUrl(true) + '/admin/mount_point/';

        let data = {
            'mount_point': e.target.value,
            '_session_id': $.cookie('_session_id')
        };

        let d = $.post(url, data).done(function (result) {
            console.log(result);
        });

        if(d.responseJSON.exists){
            alert('exists');
        }else{
            alert('does not exist');
        }

    },

    render: function () {
        return <NewToolMenu
            active={this.state.active}
            tools={this.state.installableTools}
            formData={this.state.new_tool}
            handleChangeTool={this.handleChangeTool}
            handleChangeForm={this.handleChangeForm}
            validateMountPoint={this.validateMountPoint}
            handleAddButton={this.handleAddButton}/>;
    }
});










////////////////////////////////////////////

/**
 * The main "controller view" of the NavBar.
 * @constructor
 * @param {object} initialData - Consumes the _nav.json endpoint.
 */
var Main = React.createClass({
    propTypes: {
        initialData: ToolsPropType,
        installableTools: React.PropTypes.array
    },
    getInitialState: function () {
        return {
            data: this.props.initialData,
            visible: false,
            _session_id: $.cookie('_session_id')
        };
    },

    /**
     * When invoked, this updates the state with the latest data from the server.
     */
    getNavJson: function () {
        $.get(`${_getProjectUrl(false)}/_nav.json`, function (result) {
            if (this.isMounted()) {
                this.setState({
                    data: result
                });
            }
        }.bind(this));
    },


    /**
     * Handles the locking and unlocking of the NavBar
     */
    handleToggleAdmin: function () {
        this.setState({
            visible: !this.state.visible
        });
    },

    /**
     * Handles the changing of the NavBars grouping threshold.
     * @param {object} event
     */
    onUpdateThreshold: function (event) {
        var _this = this;
        var thres = event.target.value;
        var url = `${_getProjectUrl()}/admin/configure_tool_grouping`;
        var csrf = $.cookie('_session_id');
        var data = {
            _session_id: csrf,
            grouping_threshold: thres
        };
        var _data = this.state.data;
        _data.grouping_threshold = thres;
        this.setState({
            data: _data
        });
        this.setState({
            in_progress: true
        });
        $.post(url, data, function () {
        }.bind(this)).always(function () {
            _this.setState({
                in_progress: false
            });
        });

        _this.getNavJson();
        return false;
    },

    /**
     * Handles the changing of the NavBars grouping threshold.
     * @param {array} data - Array of tools
     */
    onToolReorder: function (data) {
        var tools = this.state.data;
        var params = {
            _session_id: $.cookie('_session_id')
        };

        data.map(function (tool, i) {
            var name = getLabel(tool);
            var index = tools.children.findIndex(
                    x => x.mount_point === name
            );
            tools.children[index].ordinal = i;
            params[i] = name;
        });

        this.setState({
            data: tools
        });
        var _this = this;
        var url = _getProjectUrl() + '/admin/mount_order';
        $.ajax({
            type: 'POST',
            url: url,
            data: params,
            success: function () {
                $('#messages').notify('Tool order updated',
                    {
                        status: 'confirm'
                    });
                _this.getNavJson();
            },

            error: function () {
                $('#messages').notify('Error saving tool order.',
                    {
                        status: 'error'
                    });
            }
        });
    },

    render: function () {
        var editMode = this.state.visible ? 'edit-mode' : '';
        var _this = this;
        var navBarSwitch = (showAdmin) => {
            if (showAdmin) {
                return (
                    <AdminNav tools={ _this.state.data.children } data={ _this.state.data } onToolReorder={ _this.onToolReorder }
                              onUpdateMountOrder={ _this.onUpdateMountOrder } editMode={ _this.state.visible }
                        />
                );
            } else {
                return <NormalNavBar items={ _this.state.data.children } key={ `normalNav-${_.uniqueId()}` }/>;
            }
        };
        var navBar = navBarSwitch(this.state.visible);

        return (
            <div ref={ _.uniqueId() } className={ 'nav_admin ' + editMode }>
                { navBar }
                <div id='bar-config'>
                    <GroupingThreshold onUpdateThreshold={ this.onUpdateThreshold } isHidden={ this.state.visible }
                                       initialValue={ this.state.data.grouping_threshold }/>
                </div>
                <ToggleAdminButton key={ _.uniqueId() } handleButtonPush={ this.handleToggleAdmin } visible={ this.state.visible }/>
            </div>
        );
    }
});


   React.render(React.createElement(NewToolMain, {
        }), document.getElementById("add_tool_menu"));