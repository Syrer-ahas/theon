import bpy, math, os
from mathutils import Vector, Quaternion

OUT = r'C:\Users\alkhi\Downloads\VSCODE-USESTRICTLY!\exports\FacetedMailbox'
os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
backup = bpy.data.collections.new('Preserved original scene')
scene.collection.children.link(backup)
for obj in list(scene.objects):
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    backup.objects.link(obj)
backup.hide_viewport = True
backup.hide_render = True
asset = bpy.data.collections.new('FACETED MAILBOX - untextured')
scene.collection.children.link(asset)
parts = []

def mesh(name, verts, faces):
    data = bpy.data.meshes.new(name + ' mesh')
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    asset.objects.link(obj)
    parts.append(obj)
    return obj

def bevel(obj, amount=.025):
    mod = obj.modifiers.new('Small edge chamfers', 'BEVEL')
    mod.width = amount
    mod.segments = 1
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)
    return obj

def box(name, loc, size, chamfer=.015):
    x,y,z = [d/2 for d in size]
    verts = [(loc[0]+a*x,loc[1]+b*y,loc[2]+c*z) for a,b,c in
             [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    obj = mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    return bevel(obj,chamfer) if chamfer else obj

def prism(name, profile, ya, yb, zbase=0):
    n=len(profile)
    verts=[(x,y,z+zbase) for y in [ya,yb] for x,z in profile]
    faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
    faces += [(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
    return mesh(name,verts,faces)

def beam(name, a, b, width, depth):
    mid=(Vector(a)+Vector(b))/2
    obj=box(name,(0,0,0),(width,depth,(Vector(b)-Vector(a)).length))
    obj.location=mid
    obj.rotation_euler=(Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler()
    return obj

profile=[(-.78,0),(.78,0),(.78,.78),(.56,1.10),(.24,1.24),(-.24,1.24),(-.56,1.10),(-.78,.78)]
inner=[(x*.90,.08+z*.89) for x,z in profile]
n=len(profile)
verts=[(x,y,z+2.48) for contour in [profile,inner] for y in [-1.16,1.06] for x,z in contour]
faces=[]
for i in range(n):
    j=(i+1)%n
    faces.extend([(i,i+n,j+n,j),(2*n+i,2*n+j,3*n+j,3*n+i),
                  (i,j,2*n+j,2*n+i),(n+i,3*n+i,3*n+j,n+j)])
shell=bevel(mesh('01 Hollow faceted housing',verts,faces),.012)
prism('02 Rear closure',inner,.99,1.07,2.48)
doorprofile=[(x*.865,.10+z*.855) for x,z in profile]
door=bevel(prism('03 Recessed hinged door',doorprofile,-1.13,-1.04,2.48),.018)
# A real recessed horizontal slot, cut into the door rather than drawn on it.
cutter=box('temporary slot cutter',(0,-1.105,3.23),(.76,.30,.095),.018)
mod=door.modifiers.new('Horizontal mail slot','BOOLEAN')
mod.operation='DIFFERENCE'
mod.object=cutter
bpy.context.view_layer.objects.active=door
bpy.ops.object.modifier_apply(modifier=mod.name)
parts.remove(cutter)
bpy.data.objects.remove(cutter,do_unlink=True)
box('04 Slot inner back',(0,-1.005,3.23),(.79,.02,.12),0)
box('05 Handle left mount',(-.17,-1.18,2.88),(.065,.14,.13))
box('06 Handle right mount',(.17,-1.18,2.88),(.065,.14,.13))
box('07 Door pull',(0,-1.25,2.88),(.40,.075,.08))
for x in [-.40,.40]:
    box('08 Bottom hinge '+str(x),(x,-1.17,2.60),(.22,.095,.08))
box('09 Overhanging lower tray',(0,-.05,2.455),(1.70,2.38,.11),.035)
# Sparse longitudinal geometric ribs replace the reference's diamond pattern.
for side in [-1,1]:
    for z in [2.74,3.03]:
        box('10 Side rail '+str(side)+' '+str(z),(side*.793,.15,z),(.047,1.38,.052),.012)

# Tapered, eight-sided square post, without bark patterns or stud details.
foot=[(-.24,-.18),(-.18,-.24),(.18,-.24),(.24,-.18),(.24,.18),(.18,.24),(-.18,.24),(-.24,.18)]
verts=[(x*s,y*s+.14,z) for s,z in [(1.18,.08),(.85,2.41)] for x,y in foot]
mesh('11 Tapered chamfered post',verts,[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)])
box('12 Post cap',(0,.14,2.35),(.61,.63,.16),.025)
beam('13 Forward diagonal support',(0,.10,1.74),(0,-.80,2.39),.15,.15)
beam('14 Rear diagonal support',(0,.18,1.85),(0,.75,2.39),.15,.15)
box('15 Foot collar',(0,.14,.17),(.62,.63,.23),.035)

# Flag pivot faces outward along X; flag is a clipped pennant, not the reference shape.
bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.125,depth=.085,location=(.86,.31,3.05),rotation=(0,math.pi/2,0))
pivot=bpy.context.object
pivot.name='16 Octagonal flag pivot'
for c in list(pivot.users_collection): c.objects.unlink(pivot)
asset.objects.link(pivot)
parts.append(pivot)
beam('17 Flag stem',(.89,.31,3.07),(.89,.18,4.00),.065,.065)
flagshape=[(.17,3.98),(.75,3.98),(.94,3.84),(.75,3.67),(.22,3.67)]
verts=[(x,y,z) for x in [.855,.925] for y,z in flagshape]
mesh('18 Clipped pennant flag',verts,[(4,3,2,1,0),(5,6,7,8,9)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)])

# Separate optional base vegetation: broad angular tufts rather than studded blocks.
for i,(x,y,h,w,angle) in enumerate([(-.48,-.42,.57,.18,-.22),(-.64,.02,.79,.20,.15),(-.45,.58,.47,.18,-.30),(.48,-.32,.71,.19,.22),(.61,.28,.46,.17,-.25),(.40,.58,.84,.20,.12),(.06,.70,.49,.17,-.15),(-.08,-.54,.36,.18,.20)]):
    blade=prism('19 Optional grass blade %02d'%i,[(-w/2,0),(w/2,0),(w*.35,h*.87),(-w*.28,h)],-.055,.055)
    blade.location=(x,y,.045)
    blade.rotation_euler=(angle,angle*.6,angle*2)

# Apply transforms, fix outward normals, and retain individually editable mesh parts.
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.data.materials.clear()
    obj.select_set(True)
bpy.context.view_layer.objects.active=shell
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
scene.unit_settings.system='METRIC'
scene['Design notes']='Reference-inspired mailbox; original faceted profile, horizontal slot, clipped pennant, chamfered post. No materials or textures. Grass is optional.'

presentation=bpy.data.collections.new('Preview camera')
scene.collection.children.link(presentation)
camdata=bpy.data.cameras.new('Preview camera')
cam=bpy.data.objects.new('Preview camera',camdata)
presentation.objects.link(cam)
cam.location=(6,-8,5.2)
cam.rotation_euler=(Vector((0,0,2.0))-cam.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO'
camdata.ortho_scale=5.25
scene.camera=cam
try:
    scene.render.engine='BLENDER_WORKBENCH'
except TypeError as e:
    print(e)
shade=scene.display.shading
shade.light='STUDIO'
shade.color_type='SINGLE'
shade.single_color=(.64,.67,.71)
shade.show_shadows=True
shade.show_cavity=True
shade.cavity_type='BOTH'
shade.show_specular_highlight=True
shade.background_type='WORLD'
scene.world.color=(.055,.055,.055)
scene.render.resolution_x=1000
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.render.image_settings.file_format=next(i.identifier for i in bpy.types.ImageFormatSettings.bl_rna.properties['file_format'].enum_items if i.identifier=='PNG')
scene.render.filepath=os.path.join(OUT,'mailbox_preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.shading.type='SOLID'
        area.spaces.active.shading.color_type='SINGLE'
        area.spaces.active.shading.single_color=(.64,.67,.71)
        area.spaces.active.overlay.show_floor=False
        area.spaces.active.region_3d.view_distance=6.6
        area.spaces.active.region_3d.view_location=(0,0,2)
        area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'FacetedMailbox.blend'))
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT,'FacetedMailbox.fbx'),use_selection=True,add_leaf_bones=False,bake_anim=False)
bpy.ops.wm.obj_export(filepath=os.path.join(OUT,'FacetedMailbox.obj'),export_selected_objects=True,export_materials=False)
print('Created',len(parts),'mesh parts; vertices:',sum(len(o.data.vertices) for o in parts),'; materials:',sum(len(o.data.materials) for o in parts))
print('Saved Blender, FBX, OBJ in',OUT)
