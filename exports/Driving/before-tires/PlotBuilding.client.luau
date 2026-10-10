local Players=game:GetService('Players')
local ReplicatedStorage=game:GetService('ReplicatedStorage')
local UserInputService=game:GetService('UserInputService')
local RunService=game:GetService('RunService')
local player=Players.LocalPlayer
local gui=player:WaitForChild('PlayerGui'):WaitForChild('ZAD')
local Geometry=require(ReplicatedStorage:WaitForChild('BuildGeometry'))
local remote=ReplicatedStorage:WaitForChild('PlotBuildRequest')
local catalog=Geometry.Catalog()
local inventory=player:WaitForChild('OwnedParts')
local id,ghost,ghostSize,pose,valid,removeMode=nil,nil,nil,nil,false,false
local turn,tilt=0,0
local ghostLift,ghostContact=0,0
local waiting=false
local lastTouch
local controls=Instance.new('ScreenGui');controls.Name='BuildPlacementControls';controls.ResetOnSpawn=false;controls.DisplayOrder=100;controls.Parent=player.PlayerGui
local highlight=Instance.new('Highlight');highlight.Name='BuildRemovalHighlight';highlight.FillTransparency=.8;highlight.FillColor=Color3.fromRGB(255,70,70)
highlight.OutlineColor=Color3.fromRGB(255,90,90);highlight.DepthMode=Enum.HighlightDepthMode.Occluded;highlight.Enabled=false;highlight.Parent=controls
local function surface()
 local ref=player:FindFirstChild('AssignedPlot');local plot=ref and ref.Value
 if plot and plot:GetAttribute('OwnerUserId')==player.UserId then return Geometry.Surface(plot),plot end
end
local function cancel()
 if ghost then ghost:Destroy();ghost=nil end
 id=nil;pose=nil;valid=false;gui:SetAttribute('BuildPlacementActive',false)
end
local function selectItem()
 cancel();removeMode=false;turn=0;tilt=0
 local selected=gui:GetAttribute('SelectedBuildItemId');local entry=selected and inventory:FindFirstChild(selected)
 if not entry or entry.Value<=0 or not catalog[selected] then return end
 id=selected;ghost,ghostSize,ghostLift,ghostContact=Geometry.Clone(catalog[id]);ghost.Name='BuildPreview'
 for _,p in ghost:GetDescendants() do if p:IsA('BasePart') then p.CanCollide=false;p.CanQuery=false end end
 local outline=Instance.new('Highlight');outline.Name='PlacementOutline';outline.Adornee=ghost
 outline.FillTransparency=1;outline.OutlineTransparency=0;outline.DepthMode=Enum.HighlightDepthMode.AlwaysOnTop;outline.Parent=ghost

 ghost.Parent=workspace;gui:SetAttribute('BuildPlacementActive',true)
end
local function rayHit()
 local point=lastTouch or UserInputService:GetMouseLocation()
 local ray=workspace.CurrentCamera:ViewportPointToRay(point.X,point.Y)
 local excluded={};if player.Character then table.insert(excluded,player.Character) end;if ghost then table.insert(excluded,ghost) end
 local params=RaycastParams.new();params.FilterType=Enum.RaycastFilterType.Exclude;params.FilterDescendantsInstances=excluded
 return workspace:Raycast(ray.Origin,ray.Direction*500,params)
end
local function placedModel(hit,plot)
 local current=hit and hit.Instance
 while current and current~=plot do if current:GetAttribute('BuildItemId') and current.Parent==plot:FindFirstChild('PlacedBuild') then return current end;current=current.Parent end
end
local function request(action,data)
 if waiting then return end
 waiting=true
 task.spawn(function()
  local ok,success,message=pcall(remote.InvokeServer,remote,action,data)
  waiting=false
  if not ok or not success then if ghost then ghost.PlacementOutline.OutlineColor=Color3.fromRGB(255,25,35) end end
  if ok and success and action=='Place' then local e=id and inventory:FindFirstChild(id);if not e or e.Value<=0 then cancel() end end
 end)
end
local function placeOrRemove()
 if not gui.Enabled or waiting then return end
 local s,plot=surface();if not s then return end
 if removeMode then
  local model=placedModel(rayHit(),plot);if model then request('Remove',model.Name) end
 elseif id and pose and valid then request('Place',pose) end
end
local function toggleRemove() cancel();removeMode=not removeMode;gui:SetAttribute('BuildPlacementActive',removeMode) end
gui:GetAttributeChangedSignal('BuildSelectionRevision'):Connect(selectItem)
gui:GetPropertyChangedSignal('Enabled'):Connect(function() if not gui.Enabled then cancel();removeMode=false end end)
player.CharacterRemoving:Connect(function() cancel();removeMode=false end)
UserInputService.InputBegan:Connect(function(input,processed)
 if processed or not gui.Enabled or UserInputService:GetFocusedTextBox() then return end
 if input.KeyCode==Enum.KeyCode.R then turn=(turn+1)%4
 elseif input.KeyCode==Enum.KeyCode.T then tilt=(tilt+1)%4
 elseif input.KeyCode==Enum.KeyCode.X then cancel();removeMode=false
 elseif input.KeyCode==Enum.KeyCode.Q then toggleRemove()
 elseif input.UserInputType==Enum.UserInputType.MouseButton1 then lastTouch=nil;placeOrRemove()
 elseif input.UserInputType==Enum.UserInputType.Touch then lastTouch=Vector2.new(input.Position.X,input.Position.Y) end
end)
UserInputService.TouchMoved:Connect(function(input) lastTouch=Vector2.new(input.Position.X,input.Position.Y) end)
RunService.RenderStepped:Connect(function(dt)
 controls.Enabled=gui.Enabled
 local s,plot=surface();highlight.Enabled=false
 if not gui.Enabled then return end

 if removeMode then highlight.Adornee=plot and placedModel(rayHit(),plot);highlight.Enabled=highlight.Adornee~=nil;return end
 if not ghost or not s then return end
 local entry=inventory:FindFirstChild(id);if not entry or entry.Value<=0 then cancel();return end
 local hit=rayHit();valid=false;pose=nil
 if hit then
  local onBuildSurface=(hit.Instance==s or placedModel(hit,plot)~=nil) and hit.Normal:Dot(s.CFrame.UpVector)>.9
  local localPoint=s.CFrame:PointToObjectSpace(hit.Position)
  local x=math.round(localPoint.X/Geometry.Grid)*Geometry.Grid;local z=math.round(localPoint.Z/Geometry.Grid)*Geometry.Grid
  local y=onBuildSurface and hit.Instance~=s and math.max(0,math.round((localPoint.Y-s.Size.Y/2)*1000)/1000) or 0
  pose={id=id,x=x,y=y,z=z,turn=turn,tilt=tilt}
  local target=Geometry.Pose(s,x,y,z,turn,tilt,ghostSize,ghostLift,ghostContact)
  ghost:PivotTo(target)
  valid=onBuildSurface and Geometry.Fits(s,ghostSize,x,y,z,turn,tilt,ghostLift,ghostContact)
  local folder=plot:FindFirstChild('PlacedBuild')
  if valid and folder then local params=OverlapParams.new();params.FilterType=Enum.RaycastFilterType.Include;params.FilterDescendantsInstances={folder}
   local box,checkSize=Geometry.PlacementBox(s,x,y,z,turn,tilt,ghostSize,ghostLift,ghostContact)
   valid=#workspace:GetPartBoundsInBox(box,checkSize-Vector3.new(.04,.04,.04),params)==0
  end
 end
 local outline=ghost:FindFirstChildOfClass('Highlight');local color=valid and Color3.fromRGB(45,255,0) or Color3.fromRGB(255,25,35)
 outline.OutlineColor=color;outline.FillColor=color

end)
gui.Layout.ClearPlotButton.Activated:Connect(function() cancel();request('Clear') end)


player.PlayerGui:WaitForChild('Build'):WaitForChild('Layout'):WaitForChild('DeleteButton').Activated:Connect(function() if gui.Enabled then toggleRemove() end end)

