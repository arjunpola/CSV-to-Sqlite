const state = {
  columns: [
  ],
  tables: [
  ]
}

const getters = {
  tables: (state) => {
    return state.tables
  },
  columns: (state) => (id) => {
    let columns = []
    for (const name in state.columns[id]) {
      columns.push({name: name, type: state.columns[id][name]})
    }
    return columns
  },
  name: (state) => (id) => {
    return state.tables[id] ? state.tables[id].name : ''
  },
  path: (state) => (id) => {
    return state.tables[id] ? state.tables[id].path : ''
  },
  nextId: (state) => {
    return state.tables.length - 1
  },
  type: (state) => (id, name) => {
    return state.columns[id][name]
}
}

const mutations = {
  ADD_TABLE (state, {name, path}) {
    state.tables.push({id: state.tables.length, name: name, path: path})
    state.columns.push({})
  },
  DELETE_TABLE (state, {id}) {
    state.tables.splice(id, 1)
    state.columns.splice(id, 1)
  },
  UPDATE_COLUMNS (state, {id, columns}) {
    state.columns[id] = columns
  },
  UPDATE_NAME (state, {id, name}) {
    try {
      state.tables[id].name = name
    } catch (e) {
      console.log(id, state.tables[id])
    }

  },
  UPDATE_PATH (state, {id, path}) {
    state.tables[id].path = path
  },
  UPDATE_TYPE (state, {id, name, type}) {
    state.columns[id][name] = type
  }
}

const actions = {
  loadColumns(context, {id}) {
    return new Promise( (resolve, reject) => {
      const path = this.getters.tables[id].path
      this.$firstline(path).then((data) => {
        let columns = {}
        let columnNames = data.replace(/"/g, "").split(',')
        for (const name of columnNames) {
          columns[name] = this.state.Tables.columns[id][name] ? this.state.Tables.columns[id][name] : 'text'
        }
        context.commit('UPDATE_COLUMNS', {id: id, columns: columns})
        resolve()
      }).catch((e) => {reject(e)})
    })
  },
  export_ (context, {path}) {
    console.log(path);
    let db = new this.$sqlite3.Database(path)
    return new Promise( (resolve, reject) => {
        let tables = this.getters.tables
        let tablesLeft = tables.length
        for (let i in tables) {
          db.serialize(() => {
            db.run('DROP TABLE IF EXISTS ' + tables[i].name)
            this.dispatch('loadColumns', {id: i}).then(() => {
              setTimeout(() => {
                let columns = this.getters.columns(i)
                db.run('CREATE TABLE ' + tables[i].name + ' (' +
                  columns.map((column) => column.name + ' ' + column.type).join(',') + ')')
                let stream = this.$fs.createReadStream(tables[i].path);
                let csvStream = this.$csv({headers: true})
                  .on("data", function(data) {
                    db.run('INSERT INTO ' + tables[i].name + ' VALUES ' + '(' + columns.map(() => '? ').join(',') + ')',
                      Object.keys(data).map((key) => { return data[key] }))
                  })
                  .on("end", function() {
                    tablesLeft--
                    if (!tablesLeft) {
                      resolve()
                      db.close()
                    }
                  });
                stream.pipe(csvStream)
            }, 100)
          }).catch(e => reject(e))
        })
      }
    })
  }
}

export default {
  state,
  getters,
  mutations,
  actions
}
