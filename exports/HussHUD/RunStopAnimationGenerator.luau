local package=game.ReplicatedStorage.HussR6AnimationPack
local rig=game.StarterPlayer.StarterCharacter
local motors={}
for _,m in ipairs(rig:GetDescendants()) do if m:IsA("Motor6D") and m.Part1 then motors[m.Part1.Name]=m end end
local old=package.Clips:FindFirstChild("Stop") if old then old:Destroy() end
local sequence=Instance.new("KeyframeSequence")
sequence.Name="Stop" sequence.Loop=false sequence.Priority=Enum.AnimationPriority.Movement
local function transformed(name,x,y,z,pitch,yaw,roll)
 local basis=motors[name].C0.Rotation
 return CFrame.new(basis:VectorToObjectSpace(Vector3.new(x,y,z)))*basis:Inverse()*CFrame.Angles(math.rad(pitch),math.rad(yaw),math.rad(roll))*basis
end
-- Upright foot plant: hips stay high, shoulders recoil, arms settle after the chest.
-- time, body recoil, foot plant, arm follow-through
for _,f in ipairs({
 {0,0,0,0},{.065,.45,1,.35},{.14,1,.85,1},{.23,.55,.5,.75},{.32,.16,.15,.3},{.4,0,0,0}
}) do
 local time,body,feet,arms=f[1],f[2],f[3],f[4]
 local k=Instance.new("Keyframe") k.Time=time k.Parent=sequence
 local root=Instance.new("Pose") root.Name="HumanoidRootPart" root.Parent=k
 local torso=Instance.new("Pose") torso.Name="Torso"
 torso.CFrame=transformed("Torso",.055*body,0,.025*body,-6*body,7*body,2*body) torso.Parent=root
 local values={
  ["Head"]={0,0,0,0,0,0},
  ["Right Arm"]={0,0,0,-20*arms,-5*arms,8*arms},
  ["Left Arm"]={0,0,0,13*arms,4*arms,-7*arms},
  ["Right Leg"]={0,.015*feet,-.12*feet,-7*feet,-2*feet,1*feet},
  ["Left Leg"]={0,0,.045*feet,4*feet,2*feet,-1*feet}
 }
 for name,v in pairs(values) do
  local pose=Instance.new("Pose") pose.Name=name
  pose.CFrame=transformed(name,v[1],v[2],v[3],v[4],v[5],v[6]) pose.Parent=torso
 end
end
sequence.Parent=package.Clips
return {duration=.4,frames=#sequence:GetKeyframes(),style="Upright foot plant"}
