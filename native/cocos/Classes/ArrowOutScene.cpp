#include "ArrowOutScene.h"
#include <algorithm>
#include <string>
#include <rapidjson/document.h>
USING_NS_CC;
using namespace gogo::arrowout;
namespace {
Color4F parseColour(const std::string& value,std::size_t fallback) {
 static const Color4F palette[]={Color4F(.96f,.35f,.56f,1),Color4F(1,.62f,.26f,1),Color4F(1,.83f,.24f,1),Color4F(.29f,.86f,.50f,1),Color4F(.18f,.75f,.75f,1),Color4F(.22f,.63f,.96f,1),Color4F(.50f,.48f,.95f,1),Color4F(.76f,.53f,.95f,1)};
 if(value.size()!=7||value[0]!='#') return palette[fallback%8];
 try {
  return Color4F(std::stoi(value.substr(1,2),nullptr,16)/255.0f,
                 std::stoi(value.substr(3,2),nullptr,16)/255.0f,
                 std::stoi(value.substr(5,2),nullptr,16)/255.0f,1);
 } catch(...) { return palette[fallback%8]; }
}
}
Scene* ArrowOutScene::createScene() { auto s=Scene::create(); auto l=ArrowOutScene::create(); if(l)s->addChild(l); return s; }
bool ArrowOutScene::init() {
 if(!Layer::init()) return false;
 auto size=Director::getInstance()->getVisibleSize(); auto origin=Director::getInstance()->getVisibleOrigin();
 auto title=Label::createWithSystemFont("ARROW OUT","Arial",36);
 title->setPosition(origin.x+size.width/2,origin.y+size.height-82); addChild(title);
 status_=Label::createWithSystemFont("Loading campaign…","Arial",19);
 status_->setPosition(origin.x+size.width/2,origin.y+size.height-126); addChild(status_);
 remaining_=Label::createWithSystemFont("Arrows: —","Arial",22);
 remaining_->setPosition(origin.x+size.width/2,origin.y+72); addChild(remaining_);
 currentLevel_=std::max(1,UserDefault::getInstance()->getIntegerForKey("arrowout.native.level.v1",1));
 if(!loadLevel(currentLevel_)) setStatus("Campaign asset missing — build with export-native-levels.js");
 auto listener=EventListenerTouchOneByOne::create();
 listener->onTouchBegan=CC_CALLBACK_2(ArrowOutScene::onTouchBegan,this);
 _eventDispatcher->addEventListenerWithSceneGraphPriority(listener,this);
 return true;
}
bool ArrowOutScene::loadLevel(int level) {
 if(level<1||level>1000) { setStatus("All 1,000 campaign levels complete!"); return false; }
 const auto path="levels/level-"+std::to_string(level)+".json";
 const auto raw=FileUtils::getInstance()->getStringFromFile(path);
 if(raw.empty()) { setStatus("Cannot load "+path); return false; }
 rapidjson::Document doc; doc.Parse(raw.c_str());
 if(doc.HasParseError()||!doc.IsObject()||!doc.HasMember("cols")||!doc["cols"].IsInt()||
    !doc.HasMember("rows")||!doc["rows"].IsInt()||!doc.HasMember("arrows")||!doc["arrows"].IsArray()) {
  setStatus("Campaign level data is invalid"); return false;
 }
 Board next; next.width=doc["cols"].GetInt(); next.height=doc["rows"].GetInt();
 if(doc.HasMember("shape")&&doc["shape"].IsArray()) {
  for(const auto& c:doc["shape"].GetArray()) {
   if(!c.IsInt()&&!c.IsBool()) { setStatus("Invalid campaign shape"); return false; }
   next.shape.push_back(c.IsBool()?(c.GetBool()?1:0):static_cast<std::uint8_t>(c.GetInt()!=0));
  }
 }
 for(const auto& item:doc["arrows"].GetArray()) {
  if(!item.IsObject()||!item.HasMember("dir")||!item["dir"].IsInt()||
     !item.HasMember("step")||!item["step"].IsInt()||
     !item.HasMember("cells")||!item["cells"].IsArray()) { setStatus("Invalid arrow in campaign data"); return false; }
  Piece piece; piece.dir=item["dir"].GetInt(); piece.step=item["step"].GetInt(); piece.alive=true;
  if(item.HasMember("c")&&item["c"].IsString()) piece.color=item["c"].GetString();
  for(const auto& cell:item["cells"].GetArray()) {
   if(!cell.IsObject()||!cell.HasMember("x")||!cell["x"].IsInt()||!cell.HasMember("y")||!cell["y"].IsInt()) {
    setStatus("Invalid arrow cell"); return false;
   }
   piece.cells.push_back({cell["x"].GetInt(),cell["y"].GetInt()});
  }
  next.pieces.push_back(std::move(piece));
 }
 if(!valid(next)) { setStatus("Campaign validation failed"); return false; }
 try { (void)occupancy(next); } catch(const std::exception&) { setStatus("Campaign contains overlapping arrows"); return false; }
 board_=std::move(next); currentLevel_=level; selected_=-1; levelComplete_=false;
 const auto alive=static_cast<int>(board_.pieces.size());
 remaining_->setString("Level "+std::to_string(level)+" · Arrows: "+std::to_string(alive));
 auto size=Director::getInstance()->getVisibleSize(); auto origin=Director::getInstance()->getVisibleOrigin();
 cellSize_=std::min((size.width-36)/static_cast<float>(board_.width),(size.height-285)/static_cast<float>(board_.height));
 boardOrigin_=Vec2(origin.x+(size.width-cellSize_*board_.width)/2,origin.y+(size.height-cellSize_*board_.height)/2-5);
 setStatus("Tap an arrow body. Clear the head exit lane.");
 redraw(); return true;
}
void ArrowOutScene::resetPuzzle() { loadLevel(currentLevel_); }
bool ArrowOutScene::pointToCell(const Vec2& point,Cell& out) const {
 const auto p=convertToNodeSpace(point)-boardOrigin_;
 if(p.x<0||p.y<0||p.x>=cellSize_*board_.width||p.y>=cellSize_*board_.height) return false;
 out={static_cast<int>(p.x/cellSize_),static_cast<int>(p.y/cellSize_)};
 return true;
}
bool ArrowOutScene::onTouchBegan(Touch* touch,Event*) {
 if(board_.width<=0||board_.height<=0) return true;
 Cell c{};
 if(!pointToCell(touch->getLocation(),c)) {
  if(touch->getLocation().y<boardOrigin_.y-18) {
   if(levelComplete_) loadLevel(currentLevel_+1); else resetPuzzle();
  }
  return true;
 }
 std::vector<int> occ;
 try { occ=occupancy(board_); } catch(const std::exception&) { setStatus("Puzzle data error"); return true; }
 const int pi=occ[static_cast<std::size_t>(c.y*board_.width+c.x)];
 if(pi<0) { selected_=-1; setStatus("Tap an arrow body"); redraw(); return true; }
 selected_=pi;
 const int blocker=pieceBlocker(board_,occ,pi);
 if(blocker==-2) setStatus("Invalid arrow state");
 else if(blocker>=0) setStatus("Blocked by another arrow — clear it first");
 else if(removePiece(board_,pi)) {
  const auto left=static_cast<int>(std::count_if(board_.pieces.begin(),board_.pieces.end(),[](const Piece& p){return p.alive;}));
  remaining_->setString("Level "+std::to_string(currentLevel_)+" · Arrows: "+std::to_string(left));
  if(left==0) {
   levelComplete_=true;
   UserDefault::getInstance()->setIntegerForKey("arrowout.native.level.v1",std::min(1000,currentLevel_+1));
   UserDefault::getInstance()->flush();
   setStatus("Level clear! Tap below to continue");
  } else setStatus("Arrow cleared — keep going");
  selected_=-1;
 }
 redraw(); return true;
}
void ArrowOutScene::setStatus(const std::string& s) { if(status_) status_->setString(s); }
void ArrowOutScene::redraw() {
 removeChildByTag(900,true); auto d=DrawNode::create();
 const Color4F bg(.09f,.12f,.20f,1), inactive(.045f,.06f,.11f,1), selected(1,.82f,.26f,1);
 for(int y=0;y<board_.height;++y) for(int x=0;x<board_.width;++x) {
  Vec2 lo=boardOrigin_+Vec2(x*cellSize_,y*cellSize_);
  const auto index=static_cast<std::size_t>(y*board_.width+x);
  const bool active=board_.shape.empty()||board_.shape[index]!=0;
  d->drawSolidRect(lo+Vec2(1,1),lo+Vec2(cellSize_-1,cellSize_-1),active?bg:inactive);
 }
 for(std::size_t i=0;i<board_.pieces.size();++i) {
  const auto& p=board_.pieces[i]; if(!p.alive) continue;
  const Color4F col=static_cast<int>(i)==selected_?selected:parseColour(p.color,i);
  for(std::size_t k=1;k<p.cells.size();++k) {
   Vec2 a=boardOrigin_+Vec2((p.cells[k-1].x+.5f)*cellSize_,(p.cells[k-1].y+.5f)*cellSize_);
   Vec2 b=boardOrigin_+Vec2((p.cells[k].x+.5f)*cellSize_,(p.cells[k].y+.5f)*cellSize_);
   d->drawSegment(a,b,cellSize_*.25f,col);
  }
  const auto h=p.cells.back(); Vec2 center=boardOrigin_+Vec2((h.x+.5f)*cellSize_,(h.y+.5f)*cellSize_);
  const float r=cellSize_*.32f; Vec2 tip=center,left=center,right=center;
  if(p.dir==0){tip.y+=r;left+=Vec2(-r*.65f,-r*.5f);right+=Vec2(r*.65f,-r*.5f);}
  if(p.dir==1){tip.x+=r;left+=Vec2(-r*.5f,r*.65f);right+=Vec2(-r*.5f,-r*.65f);}
  if(p.dir==2){tip.y-=r;left+=Vec2(r*.65f,r*.5f);right+=Vec2(-r*.65f,r*.5f);}
  if(p.dir==3){tip.x-=r;left+=Vec2(r*.5f,-r*.65f);right+=Vec2(r*.5f,r*.65f);}
  d->drawSolidTriangle(tip,left,right,col);
 }
 d->setTag(900); addChild(d,1);
}
