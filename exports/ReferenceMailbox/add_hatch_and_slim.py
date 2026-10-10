import bpy, bmesh, math, os
from mathutils import Matrix, Vector
OUT=r'C:\Users\alkhi\Downloads\VSCODE-USESTRICTLY!\exports\ReferenceMailbox'
asset=bpy.data.collections['REFERENCE MAILBOX - untextured geometry']
scene=bpy.context.scene
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')

def replace_mesh(obj,verts,faces):
    old=obj.data;materials=list(old.materials)
    data=bpy.data.meshes.new(obj.name+' slimmer mesh')
    data.from_pydata(verts,[],faces);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    for material in materials:data.materials.append(material)
    obj.data=data
    if not old.users:bpy.data.meshes.remove(old)

# Reduce the shell wall itself while keeping its familiar low-poly arch.
Z=2.55;R=.69;SHOULDER=3.44
arc=[(R*math.cos(math.pi*i/8),SHOULDER+R*math.sin(math.pi*i/8)) for i in range(9)]
profile=[(-R,Z),(R,Z)]+arc
inner=[(x*.915,Z+.045+(z-Z)*.96) for x,z in profile]
n=len(profile)
faces=[]
for i in range(n):
    j=(i+1)%n
    faces += [(i,j,j+n,i+n),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(i+n,j+n,3*n+j,3*n+i)]
shell=asset.objects['Mailbox arched shell']
replace_mesh(shell,[(x,y,z) for contour in [profile,inner] for y in [-.96,.96] for x,z in contour],faces)
cyan=next(m for m in bpy.data.materials if m.name.startswith('Solid cyan'))
navy=next(m for m in bpy.data.materials if m.name.startswith('Solid navy'))
shell.data.materials.clear();shell.data.materials.append(cyan);shell.data.materials.append(navy)
for i,p in enumerate(shell.data.polygons):p.material_index=1 if i%4==1 else 0

# The existing front panel becomes an actual bottom-hinged hatch.
hatch=asset.objects['Deep inset arched front door']
hatch.name='Front hatch - bottom hinge'
doorprofile=[(x*.875,Z+.045+(z-Z)*.955) for x,z in profile]
doorfaces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
replace_mesh(hatch,[(x,y,z) for y in [-.925,-.865] for x,z in doorprofile],doorfaces)
hatch.data.materials.clear();hatch.data.materials.append(cyan)

# Slim width and depth modestly, preserving all existing placements in world space.
for obj in asset.objects:
    mat=obj.matrix_world.copy()
    center=sum((mat@v.co for v in obj.data.vertices),Vector())/len(obj.data.vertices)
    for vertex in obj.data.vertices:
        p=mat@vertex.co
        if obj.name in ['Flag upright pole','Rounded horizontal flag tab']:
            p.x=center.x+(p.x-center.x)*.8
        elif obj.name=='Flag octagonal pivot':
            p.x=center.x+(p.x-center.x)*.8
            p.y=center.y+(p.y-center.y)*.9
            p.z=center.z+(p.z-center.z)*.9
        p.x*=.90;p.y*=.94
        vertex.co=p
    obj.matrix_world=Matrix.Identity(4)
    obj.data.update()

# Place the origin on the lower hinge, so the hatch can be opened or closed by rotation.
hinge=Vector((0,-.925*.94,(Z+.045)))
for vertex in hatch.data.vertices:vertex.co-=hinge
hatch.location=hinge
hatch.rotation_euler.x=math.radians(100)
hatch['Hatch instructions']='Rotate local X: 0 degrees closed, 90 degrees horizontal open. Currently 100 degrees open.'
hatch['Closed angle degrees']=0.0
hatch['Open angle degrees']=100.0
scene['Design notes']='Smooth reference mailbox, thinner shell and hatch; width reduced 10 percent and depth 6 percent. Bottom-hinged cyan hatch shown open. No studs, X grooves, grass, or textures.'

# Keep the open flap comfortably inside the preview.
camera=scene.camera
camera.data.ortho_scale=5.55
camera.rotation_euler=(Vector((0,-.25,2.24))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.select_all(action='DESELECT')
for obj in asset.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=hatch
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT,'ReferenceMailbox.fbx'),use_selection=True,add_leaf_bones=False,bake_anim=False)
bpy.ops.wm.obj_export(filepath=os.path.join(OUT,'ReferenceMailbox.obj'),export_selected_objects=True,export_materials=True)
bpy.ops.object.select_all(action='DESELECT')
hatch.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'ReferenceMailbox.blend'))
scene.render.filepath=os.path.join(OUT,'reference_mailbox_preview.png')
bpy.ops.render.render(write_still=True)
print('Added bottom-hinged open hatch; slimmed width, depth, wall thickness, hatch thickness, and flag.')
