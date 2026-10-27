import { actions, useApp } from './store'
import { Modal, notify } from './ui'
import type { Project } from './types'

// Tim & akses proyek: tugaskan pengguna (mis. Document Control) ke proyek tertentu.
export function ProjectAccess({ project, onClose }: { project: Project; onClose: () => void }) {
  const { state } = useApp()
  const users = state.users.filter((u) => u.active)
  const toggle = (id: string, on: boolean) => {
    const u = state.users.find((x) => x.id === id)
    if (!u || u.allowedProjects === 'all') return
    const next = on ? [...u.allowedProjects, project.id] : u.allowedProjects.filter((x) => x !== project.id)
    try { actions.updateUser(id, { allowedProjects: next }) } catch (e: any) { notify(e.message) }
  }
  return (
    <Modal title={`Akses Proyek · ${project.code}`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>Pengguna yang boleh melihat dan menangani proyek ini. Administrator dan pengguna dengan akses semua proyek selalu dapat mengaksesnya. Peran seperti <b>Document Control Proyek</b> hanya bisa mengakses proyek yang dicentang.</p>
      <div className="tw"><table>
        <thead><tr><th>Pengguna</th><th>Peran</th><th>Akses</th></tr></thead>
        <tbody>
          {users.map((u) => {
            const all = u.roleId === 'admin' || u.allowedProjects === 'all'
            const role = state.roles.find((r) => r.id === u.roleId)
            return (
              <tr key={u.id}>
                <td><b>{u.name}</b><div className="muted">@{u.username}</div></td>
                <td>{role?.name || u.roleId}{role?.projectScoped && <span className="pill" style={{ marginLeft: 6 }}>per proyek</span>}</td>
                <td>{all ? <span className="muted">Semua proyek</span> : (
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'inherit', margin: 0 }}>
                    <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={(u.allowedProjects as string[]).includes(project.id)} onChange={(e) => toggle(u.id, e.target.checked)} /> Ditugaskan
                  </label>
                )}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Untuk membuat Document Control khusus proyek: menu Pengguna → Pengguna Baru → peran <b>Document Control Proyek</b>, lalu pilih proyeknya.</p>
    </Modal>
  )
}
