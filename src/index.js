import {
  Message,
  Button,
  Link,
  Pagination,
  Table,
  TableColumn
} from "element-ui";
import { throttle } from "lodash";
import { isEmptyObject, isObject } from "./utils.js";
import "./index.scss";

export default {
  name: "ElTableJSON",
  inheritAttrs: false,
  props: {
    ...Table.props,
    // 表格数据
    data: {
      type: Array,
      default: () => []
    },
    /**
     * 字段列信息
     *  {
     *    label: '名称',
     *    prop: '字段属性',
     *    // 表头嵌套
     *    nests: []
     *  }
     *
     */
    columns: {
      type: Array,
      default: () => []
    },
    // 是否分页
    pagination: {
      type: Boolean,
      default: true
    },
    // 每页条数
    pageSize: {
      type: Number,
      default: 10
    },
    // 页码大小
    pageSizes: {
      type: Array,
      default: () => [5, 10, 20, 50, 100, 200]
    },
    // 总条数
    total: {
      type: Number,
      default: 0
    },
    // 当前页码
    currentPage: {
      type: Number,
      default: 1
    },
    /**
     * 默认表格的高度是充满父容器的
     * 如果height 设置为 'auto',则表格高度将会根据内容自动撑起来
     */
    height: {
      type: [Number, String],
      default: 0
    },
    // 表格是否排序
    sortable: {
      type: Boolean,
      default: false
    },
    // 行唯一值
    rowKey: {
      type: String,
      default: "id"
    }
  },
  data() {
    return {
      // 复选框选中的行
      selectRows: [],
      // 点击行选中的当前行
      currentRow: undefined,
      // 内部高度，动态计算
      innerHeight: 0,
      // 分页条的高度 TODO: 暂时写死，
      paginationHeight: 52
    };
  },
  computed: {
    /**
     * 计算表格区域高度
     */
    tableHeight() {
      const { height, innerHeight, pagination, paginationHeight } = this;
      if (height) {
        let customHeight = height;
        if (typeof customHeight === "string") {
          if (customHeight.endsWith("px")) {
            customHeight = parseFloat(customHeight);
          }
        }
        if (typeof customHeight === "number") {
          // 注意搜索框高度
          return customHeight - (pagination ? paginationHeight : 0);
        }
        return customHeight;
      } else {
        return innerHeight;
      }
    },
    /**
     * 计算表格容器的高度
     */
    tableContainerHeight() {
      const { height, tableHeight } = this;
      if (height) {
        if (typeof height === "number") {
          return `${height}px`;
        }
        return height;
      }
      return "100%";
    }
  },
  mounted() {
    // 如果没有设置高度，则自动计算高度
    if (!this.height) {
      this.innerHeight = this.$refs.table.$el.parentElement.offsetHeight;
      this._listenerResize();
    }
  },
  // 当表格所在页面存在keepalive时，需要在页面显示时重新布局表格
  activated() {
    this.doLayout();
  },
  watch: {
    "data.length": {
      handler(n, o) {
        if (n === 0 && o > 0 && this.currentPage > 1) {
          this._handlePageCurrentChange(this.currentPage - 1);
        }
      }
    }
  },
  methods: {
    /**
     * 表格主体
     * @param {*} h
     */
    _renderTable(h) {
      try {
        const { tableHeight, rowKey, $attrs, _props: defaultProps } = this;
        const { height, ...restProps } = {
          ...defaultProps,
          ...$attrs
        };
        const props = restProps;
        if (tableHeight && tableHeight !== "auto") {
          props["height"] = tableHeight;
        }
        const {
          $listeners,
          _renderAllColumns,
          _handleTableSelectionChange,
          _handleTableCurrentChange,
          _handleSortChange,
          _handleRowClick,
          _handleSelect,
          $slots,
          doSortAllVNodeByRowId
        } = this;
        /**
         * 插入slot default
         */
        const jsonVNode = _renderAllColumns(h) || [];
        const slotVNode = $slots.default || [];
        let allVNodes = [...jsonVNode, ...slotVNode];
        allVNodes = doSortAllVNodeByRowId(allVNodes);
        return (
          <div class="el-table-json__container">
            <Table
              rowKey={rowKey}
              {...{
                on: {
                  ...$listeners,
                  "selection-change": _handleTableSelectionChange,
                  "current-change": _handleTableCurrentChange,
                  "sort-change": _handleSortChange,
                  "row-click": _handleRowClick,
                  select: _handleSelect
                },
                props: {
                  ...props
                }
              }}
              class="el-table-json__body"
              ref="table"
            >
              {allVNodes}
            </Table>
          </div>
        );
      } catch (error) {
        console.log(`renderTable: ${error}`);
      }
    },
    _renderAllColumns(h) {
      const { columns, _renderColumns } = this;
      const colVNodes = [];
      colVNodes.push(..._renderColumns(h, columns));
      return colVNodes;
    },
    /**
     * 表格列
     * @param {*} h
     * @param {*} columns
     */
    _renderColumns(h, columns) {
      // 整体是否排序
      let sortable = this.sortable ? "custom" : false;
      return columns
        .filter(column => {
          const { hidden } = column;
          if (hidden !== undefined) {
            if (typeof hidden === "function") {
              return !hidden({
                columns,
                column
              });
            }
            return !hidden;
          }
          return true;
        })
        .map(column => {
          const {
            useSlot = false,
            // 如果存在操作按钮，则actions为非空
            actions = null,
            // 是否有嵌套列
            nests,
            // 链接列 Link组件
            links = {}
          } = column;
          let newSortable = sortable;
          if (column.sortable !== undefined) {
            newSortable = column.sortable ? "custom" : false;
          }
          column = {
            ...column,
            sortable: newSortable
          };
          const {
            _renderNestColumn,
            _renderSlotColumn,
            _renderLinkColumn,
            _renderActionColumn,
            _renderDefaultColumn
          } = this;
          /**
           * useSlot和link可以同时存在？
           */
          if (nests && nests.length) {
            return _renderNestColumn(h, column);
          }
          if (useSlot) {
            return _renderSlotColumn(h, column);
          }
          const hasLink = isEmptyObject(links);
          if (!hasLink) {
            return _renderLinkColumn(h, column);
          }
          const hasArray = Array.isArray(actions) && actions.length > 0;
          const hasObject = isObject(actions) && !isEmptyObject(actions);
          if (actions && (hasArray || hasObject)) {
            column.sortable = false;
            return _renderActionColumn(h, column);
          }
          return _renderDefaultColumn(h, column);
        });
    },
    // 渲染嵌套列
    _renderNestColumn(h, column) {
      const { label, nests, align = "left" } = column;
      return (
        <TableColumn label={label} headerAlign={align}>
          {this._renderColumns(h, nests)}
        </TableColumn>
      );
    },
    /**
     * 链接
     * @param {*} h
     * @param {*} column
     */
    _renderLinkColumn(h, column) {
      const {
        events = {},
        prop,
        showOverflowTooltip = true,
        links = {},
        ...rest
      } = column;
      return (
        <TableColumn
          showOverflowTooltip={showOverflowTooltip}
          {...{
            props: {
              ...rest,
              prop
            },
            on: {
              ...events
            },
            scopedSlots: {
              default: ({ row, column, $index }) => {
                const { click, text, underline = false, ...linkProps } = links;
                const onClick =
                  click &&
                  throttle(
                    () => click.apply(null, [row, column, $index]),
                    100,
                    {
                      trailing: false
                    }
                  );
                const linkClass = `el-table-json__link ${
                  showOverflowTooltip ? "overflow-tips" : ""
                }`;
                return (
                  <Link
                    onClick={onClick}
                    props={linkProps}
                    underline={underline}
                    class={linkClass}
                  >
                    {text || row[prop]}
                  </Link>
                );
              }
            }
          }}
        />
      );
    },
    /**
     * 普通列
     * @param {*} h
     * @param {*} column
     */
    _renderDefaultColumn(h, column) {
      const {
        events = {},
        minWidth = "100",
        showOverflowTooltip = true,
        ...rest
      } = column;
      return (
        <TableColumn
          minWidth={minWidth}
          showOverflowTooltip={showOverflowTooltip}
          {...{
            props: rest,
            on: {
              ...events
            }
          }}
        />
      );
    },
    /**
     * 渲染操作列
     * actions <object, array>
     * @param {*} h
     * @param {*} column
     */
    _renderActionColumn(h, column) {
      const {
        label,
        // 如果存在操作按钮，则actions为非空
        actions = null,
        events = {},
        minWidth = "150",
        fixed = "right",
        align = "left",
        width = 120
      } = column;
      const buttonScope = this.$scopedSlots.action;
      return (
        <TableColumn
          resizable={false}
          label={label}
          minWidth={minWidth}
          fixed={fixed}
          align={align}
          width={width}
          className="el-table-json__actioncolumn"
          {...{
            scopedSlots: {
              default: ({ row, column, $index }) => {
                let actionBtns = actions || [];
                if (actionBtns && isObject(actionBtns)) {
                  actionBtns = [actions];
                }
                return this._renderButtons(
                  h,
                  actionBtns,
                  {
                    type: "text"
                  },
                  buttonScope,
                  [row, column, $index],
                  // 插槽的参数
                  {
                    row,
                    column,
                    $index
                  }
                );
              }
            },
            on: {
              ...events
            }
          }}
        />
      );
    },

    // 渲染插槽列
    _renderSlotColumn(h, column) {
      const {
        prop,
        label,
        minWidth = "120",
        events = {},
        align = "left",
        field,
        useSlot,
        showOverflowTooltip = true,
        ...rest
      } = column;
      const columnScope = this.$scopedSlots.column;
      const headerScope = this.$scopedSlots.header;
      return (
        <TableColumn
          prop={prop}
          label={label}
          minWidth={minWidth}
          align={align}
          showOverflowTooltip={showOverflowTooltip}
          {...{
            scopedSlots: {
              default: scope => {
                if (columnScope) {
                  return columnScope({
                    ...scope,
                    prop,
                    field,
                    cellValue: scope.row[prop]
                  });
                }

                return scope.row[prop];
              },
              header: scope => {
                if (headerScope) {
                  return headerScope({
                    ...scope,
                    label,
                    field,
                    prop
                  });
                }
                return scope.column.label;
              }
            },
            props: rest,
            on: {
              ...events
            }
          }}
        />
      );
    },
    // 预处理操作按钮
    _preDealButtons(actions, ...args) {
      /**
       * 分析函数属性
       * @param {Function, String ,Boolean} prop 要分析的属性
       */
      const analyseFunProp = prop => {
        return typeof prop === "function" ? prop(...args) : prop;
      };
      return actions
        .filter(({ before = true }) => {
          return analyseFunProp(before);
        })
        .map(({ click, disabled = false, children = [], ...rest }) => {
          // 特殊处理点击事件
          const onClick =
            click &&
            throttle(() => click(...args), 100, {
              trailing: false
            });
          return {
            click: onClick || (() => ({})),
            disabled: analyseFunProp(disabled),
            children: this._preDealButtons(children, ...args),
            ...rest
          };
        });
    },
    /**
     * 渲染按钮统一处理方法
     * @param {*} h
     */
    // eslint-disable-next-line max-params
    _renderButtons(h, buttons, props, slot, args, slotArgs) {
      const newActions = this._preDealButtons(buttons, ...args);

      return newActions.map(btn => {
        const {
          click,
          text,
          children, // 待定
          useSlot,
          directives = [],
          ...rest
        } = btn;
        if (useSlot) {
          if (!slot) {
            throw new Error("Add slot pls.");
          }
          return slot({
            ...btn,
            ...slotArgs
          });
        }
        const button = (
          <Button
            {...{ props: { ...rest, ...props }, directives }}
            onClick={click}
          >
            {text}
          </Button>
        );
        return button;
      });
    },
    // 渲染分页
    _renderPage(h) {
      const {
        pagination,
        pageSize,
        pageSizes,
        total,
        currentPage,
        _handlePageSizeChange,
        _handlePageCurrentChange
      } = this;
      return pagination ? (
        <div class="el-table-json__page gt-common__pagination">
          <Pagination
            background
            total={total}
            currentPage={currentPage}
            pageSize={pageSize}
            pageSizes={pageSizes}
            layout="total,sizes,prev,pager,next,jumper"
            {...{
              on: {
                "size-change": _handlePageSizeChange,
                "current-change": _handlePageCurrentChange
              }
            }}
          />
        </div>
      ) : null;
    },
    // 表格每页条数发生变化触发
    _handlePageSizeChange(pageSize) {
      const { total, currentPage } = this;
      this.$emit("update:pageSize", pageSize);
      // 如果总页码小于当前页码，则当前页码会变化，触发handleCurrentChange
      if (Math.ceil(total / pageSize) >= currentPage) {
        this.$emit("page-change", {
          pageSize
        });
      }
    },
    // 表格页码发生变化触发
    _handlePageCurrentChange(currentPage) {
      this.$emit("update:currentPage", currentPage);
      this.$emit("page-change", {
        currentPage
      });
    },
    // 当选择项发生变化时会触发该事件
    _handleTableSelectionChange(selection) {
      this.selectRows = selection;
      this.$emit("selection-change", selection);
    },
    _handleSelect(selection, row) {
      this.setCurrentRow(row);
      this.$emit("select", selection, row);
    },
    _handleRowClick(row, column, event) {
      // 行点击时 只能选中一行
      // this.$refs.table.clearSelection();
      // this.toggleRowSelection(row, true);
      this.$emit("row-click", row, column, event);
    },
    // 表格的当前行发生变化的时候会触发该事件
    _handleTableCurrentChange(newRow, oldRow) {
      this.currentRow = newRow;

      this.$emit("current-change", newRow, oldRow);
    },
    // 排序
    _handleSortChange({ prop, order }) {
      if (order) {
        this.$emit("sort-change", {
          propName: prop,
          asc: order === "ascending"
        });
      } else {
        this.$emit("sort-change", {});
      }
    },
    // 通过给定的key值寻找行数据
    _findDataByKey(value) {
      const { rowKey, data } = this;
      const find = (value, data) => {
        let dt;
        for (let i = 0; i < data.length; i++) {
          dt = data[i];
          if (dt[rowKey] === value) {
            return dt;
          } else if (dt.children) {
            dt = find(value, dt.children);
            if (dt) {
              return dt;
            }
          }
        }
      };
      return find(value, data);
    },
    /**
     * 给默认的Vnode排序，安插slot的列和json的列。
     * rowId表示该列想插入的位置。
     * 插入排序 从1开始计数
     * @param {*} vnodes
     */
    doSortAllVNodeByRowId(vnodes) {
      const ROW_SORT_ID = "rowId";
      const DEFAULT_SORT_ID = "defaultId";
      const setPropIdx = vnodes => {
        vnodes.forEach((node, index) => {
          if (node) {
            node[DEFAULT_SORT_ID] = index + 1;
            node[ROW_SORT_ID] = parseInt(node.data.attrs[ROW_SORT_ID]);
          }
        });
      };
      setPropIdx(vnodes);
      /**
       * 排序相关数组
       * @param {*} insertArr
       */
      const sortedInsert = insertArr => {
        return insertArr.sort(
          (a, b) =>
            (a[ROW_SORT_ID] || a[DEFAULT_SORT_ID]) -
            (b[ROW_SORT_ID] || b[DEFAULT_SORT_ID])
        );
      };
      const sortedVNodes = sortedInsert(vnodes);
      return sortedVNodes;
    },
    // 获取复选框选中的行
    getSelectionRows() {
      return this.selectRows;
    },
    // 获取单选选中的行
    getCurrentRow() {
      return this.currentRow;
    },
    // 设置当前选中的行
    setCurrentRow(row) {
      this.$refs.table.setCurrentRow(row);
    },
    // 设置当前选中的行展开
    toggleRowExpansion(row, isExpand) {
      this.$refs.table.toggleRowExpansion(row, isExpand);
    },
    toggleRowSelection(row, select) {
      this.$refs.table.toggleRowSelection(row, select);
    },

    // 重新布局表格
    doLayout() {
      this.$refs.table.doLayout();
      this._listenerResize();
    },
    /**
     * 监听表格高度
     */
    _listenerResize() {
      const listenerResize = throttle(() => {
        this.innerHeight = this.$refs.table.$el.parentElement.offsetHeight;
      }, 200);
      window.addEventListener("resize", listenerResize);
      // 渲染完成之后立即执行一次，保证不会出现滚动条
      this.$nextTick(() => {
        listenerResize();
      });
      // 销毁时候释放监听的事件
      this.$once("hook:beforeDestroy", () => {
        window.removeEventListener("resize", listenerResize);
      });
    }
  },

  render(h) {
    const { _renderTable, _renderPage, tableContainerHeight } = this;
    return (
      <div class="el-table-json" style={{ height: tableContainerHeight }}>
        {_renderTable(h)}
        {_renderPage(h)}
      </div>
    );
  }
};
