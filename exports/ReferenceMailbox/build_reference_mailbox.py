import bpy, bmesh, math, os
from mathutils import Vector
OUT=r'C:\Users\alkhi\Downloads\VSCODE-USESTRICTLY!\exports\ReferenceMailbox'
os.makedirs(OUT,exist_ok=True)
scene=bpy.context.scene
if bpy.context.object and bpy.context.object.mode!='OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
for collection_name in ['REFERENCE MAILBOX - untextured geometry','Reference model preview camera']:
    old=bpy.data.collections.get(collection_name)
    if old:
        for obj in list(old.objects):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(old)
for c in list(scene.collection.children):
    c.hide_viewport=True
    c.hide_render=True
asset=bpy.data.collections.new('REFERENCE MAILBOX - untextured geometry')
scene.collection.children.link(asset)
parts=[]

def mesh(name,verts,faces):
    data=bpy.data.meshes.new(name+' mesh')
    data.from_pydata(verts,[],faces)
    data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    obj=bpy.data.objects.new(name,data)
    asset.objects.link(obj)
    parts.append(obj)
    return obj
def bevel(o,w=.01):
    m=o.modifiers.new('Edge bevel','BEVEL'); m.width=w; m.segments=1
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=m.name)
    return o
def box(name,loc,size,b=.005):
    x,y,z=[d/2 for d in size]
    v=[(loc[0]+a*x,loc[1]+b*y,loc[2]+c*z) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    o=mesh(name,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    return bevel(o,b) if b else o
def prism(name,profile,ya,yb):
    n=len(profile)
    return mesh(name,[(x,y,z) for y in [ya,yb] for x,z in profile],[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
def beam(name,a,b,width,depth):
    o=box(name,(0,0,0),(width,depth,(Vector(b)-Vector(a)).length),0)
    o.location=(Vector(a)+Vector(b))/2
    o.rotation_euler=(Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler()
    return o
def cut(o,c):
    bpy.context.view_layer.objects.active=o
    m=o.modifiers.new('Modeled recess','BOOLEAN');m.object=c;m.operation='DIFFERENCE'
    bpy.ops.object.modifier_apply(modifier=m.name)
    parts.remove(c);bpy.data.objects.remove(c,do_unlink=True)

# Flat base and vertical walls, with a low-poly semicircular roof.
Z=2.55; R=.69; SHOULDER=3.44
arc=[(R*math.cos(math.pi*i/8),SHOULDER+R*math.sin(math.pi*i/8)) for i in range(9)]
profile=[(-R,Z),(R,Z)]+arc
inner=[(x*.86,Z+.06+(z-Z)*.94) for x,z in profile]
n=len(profile)
v=[(x,y,z) for contour in [profile,inner] for y in [-.96,.96] for x,z in contour]
f=[]
for i in range(n):
    j=(i+1)%n
    f += [(i,j,j+n,i+n),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(i+n,j+n,3*n+j,3*n+i)]
body=mesh('Mailbox arched shell',v,f)
prism('Mailbox back panel',inner,.895,.96)
door=prism('Deep inset arched front door',[(x*.835,Z+.055+(z-Z)*.925) for x,z in profile],-.892,-.81)

# The reference's four diagonal arms, carved into the front panel.
for sx in [-1,1]:
    for sz in [-1,1]:
        a=(sx*.09,-.895,3.30+sz*.105)
        b=(sx*.44,-.895,3.30+sz*.56)
        cutter=beam('Door X groove cutter',a,b,.048,.045)
        cut(door,cutter)

# Side X grooves follow the faceted roof instead of floating above it.
def surface_x(z):
    if z<=SHOULDER: return R
    for i in range(4):
        x1,z1=arc[i];x2,z2=arc[i+1]
        if z1<=z<=z2: return x1+(x2-x1)*(z-z1)/(z2-z1)
    return 0
def side_groove(side,ya,za,yb,zb):
    verts=[]; count=12
    dy=yb-ya;dz=zb-za;length=math.hypot(dy,dz)
    ny=-dz/length*.023;nz=dy/length*.023
    for i in range(count):
        t=i/(count-1); y=ya+dy*t;z=za+dz*t
        for yy,zz,depth in [(y+ny,z+nz,-.028),(y-ny,z-nz,-.028),(y-ny,z-nz,.035),(y+ny,z+nz,.035)]:
            verts.append((side*(surface_x(zz)+depth),yy,zz))
    faces=[(3,2,1,0),tuple(range(4*(count-1),4*count))]
    for i in range(count-1):
        for j in range(4): faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    cut(body,mesh('Side X groove cutter',verts,faces))
for side in [-1,1]:
    for sy in [-1,1]:
        for sz in [-1,1]:
            side_groove(side,sy*.105,3.32+sz*.10,sy*.78,3.32+sz*.60)
# Little bottom hinge tabs are visible in the screenshots.
for x in [-.43,.43]:box('Front bottom hinge',(x,-.977,2.595),(.075,.048,.11),.002)
box('Small top latch',(0,-.86,4.14),(.115,.085,.035),0)

# Tall square post and one diagonal support match the reference proportions.
post=box('Square support post',(0,.13,1.28),(.55,.55,2.56),0)
brace=beam('Diagonal support',(0,.13,1.70),(0,.77,2.53),.23,.23)
# Repeated inset square stud outlines are mesh details, not textures.
for row in range(9):
    z=.30+row*.255
    for col in [-1,1]:
        x=col*.14+( .025 if row%2 else -.015)
        for front in [-1,1]:
            y=.13+front*.276
            cutter=box('Post square outline recess',(x,y,z),(.155,.024,.17),.012)
            cut(post,cutter)
            box('Post inset square',(x,y-front*.006,z),(.116,.012,.133),.01)
    for side in [-1,1]:
        y=.13+(.12 if row%2 else -.12)
        cutter=box('Post side recess',(side*.276,y,z),(.024,.16,.18),.012)
        cut(post,cutter)
        box('Post side inset square',(side*.270,y,z),(.012,.122,.143),.01)

# Slim upright flag with rounded rectangular tab and octagonal pivot.
bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.132,depth=.09,location=(.735,-.48,3.26),rotation=(0,math.pi/2,0))
pivot=bpy.context.object;pivot.name='Flag octagonal pivot'
for c in list(pivot.users_collection):c.objects.unlink(pivot)
asset.objects.link(pivot);parts.append(pivot)
box('Flag upright pole',(.747,-.48,3.925),(.058,.085,1.31),0)
flag=[(-.52,4.57),(.03,4.57),(.13,4.55),(.20,4.48),(.20,4.39),(.13,4.31),(.03,4.29),(-.52,4.29)]
verts=[(x,y,z) for x in [.716,.780] for y,z in flag]
mesh('Rounded horizontal flag tab',verts,[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)])

# Squared chunky grass stalks around the post, as in all four references.
tufts=[(-.46,-.42,.88,.18,.20),(-.57,-.04,1.10,.18,.19),(-.45,.40,.56,.20,.18),(-.26,.57,.79,.17,.18),(.42,-.42,.64,.18,.19),(.51,-.07,1.00,.19,.18),(.40,.39,.45,.20,.20),(.18,.58,.71,.18,.17),(-.14,-.50,.44,.18,.18),(.13,-.57,.29,.20,.19),(-.65,.24,.38,.18,.18),(.65,.22,.35,.17,.17)]
for i,(x,y,h,w,d) in enumerate(tufts):
    box('Block grass %02d'%i,(x,y,h/2),(w,d,h),0)
    if i%2==0:
        box('Grass inset vertical notch %02d'%i,(x+w*.18,y-d/2-.009,h*.60),(.043,.025,h*.38),.005)

bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.data.materials.clear();o.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
scene['Design notes']='Rebuilt to closely match the four supplied screenshots: arched box, recessed X door, X side grooves, rounded flag, square patterned post, block grass. Entirely untextured geometry.'
preview=bpy.data.collections.new('Reference model preview camera');scene.collection.children.link(preview)
camdata=bpy.data.cameras.new('Reference preview');cam=bpy.data.objects.new('Reference preview',camdata);preview.objects.link(cam)
cam.location=(6,-8,4.2);cam.rotation_euler=(Vector((0,0,2.24))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=5.40;scene.camera=cam
try:scene.render.engine='BLENDER_WORKBENCH'
except TypeError as e:print(e)
shade=scene.display.shading;shade.light='STUDIO';shade.color_type='SINGLE';shade.single_color=(.64,.67,.71);shade.show_cavity=True;shade.cavity_type='BOTH';shade.show_shadows=True;shade.background_type='WORLD'
scene.world.color=(.06,.06,.06)
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format=next(i.identifier for i in bpy.types.ImageFormatSettings.bl_rna.properties['file_format'].enum_items if i.identifier=='PNG')
scene.render.filepath=os.path.join(OUT,'reference_mailbox_preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        s=area.spaces.active;s.shading.type='SOLID';s.shading.color_type='SINGLE';s.shading.single_color=(.64,.67,.71);s.overlay.show_floor=False;s.region_3d.view_distance=7;s.region_3d.view_location=(0,0,2.2);s.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
colors={'cyan':(0,.58,.94,1),'navy':(.018,.042,.26,1),'red':(1,.025,.07,1),'post':(.29,.19,.23,1),'grass':(.32,.57,.005,1)}
materials={}
for name,color in colors.items():
    m=bpy.data.materials.new('Solid '+name+' - no textures');m.use_nodes=True;m.diffuse_color=color
    node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');node.inputs['Base Color'].default_value=color;node.inputs['Roughness'].default_value=.85
    materials[name]=m
for o in parts:
    name=o.name
    if 'grass' in name.lower():key='grass'
    elif 'post' in name.lower() or name=='Diagonal support':key='post'
    elif name in ['Deep inset arched front door','Flag octagonal pivot','Small top latch']:key='navy'
    elif name in ['Flag upright pole','Rounded horizontal flag tab']:key='red'
    else:key='cyan'
    o.data.materials.append(materials[key])
shade.color_type='MATERIAL'
shade.studio_light=next(s.name for s in bpy.context.preferences.studio_lights if s.name=='paint.sl')
shade.show_shadows=False
try:scene.view_settings.view_transform='Standard'
except TypeError as e:print(e)
scene.view_settings.exposure=.3
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.shading.color_type='MATERIAL';area.spaces.active.shading.studio_light=shade.studio_light;area.spaces.active.shading.show_shadows=False
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT,'ReferenceMailbox.fbx'),use_selection=True,add_leaf_bones=False,bake_anim=False)
bpy.ops.wm.obj_export(filepath=os.path.join(OUT,'ReferenceMailbox.obj'),export_selected_objects=True,export_materials=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'ReferenceMailbox.blend'))
bpy.ops.render.render(write_still=True)
print('Saved reference model:',len(parts),'mesh parts;',sum(len(o.data.materials) for o in parts),'materials;',sum(len(p.vertices)-2 for o in parts for p in o.data.polygons),'triangles')
