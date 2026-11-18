#include "ArrowOutScene.h"
#include <array>
#include <cmath>
USING_NS_CC;
using namespace gogo::arrowout;
Scene* ArrowOutScene::createScene() { auto s=Scene::create(); auto l=ArrowOutScene::create(); if(l)s->addChild(l); return s; }
bool ArrowOutScene::init() {
 if(!Layer::init()) return false;
 auto size=Director::getInstance()->getVisibleSize(); auto origin=Director::getInstance()->getVisibleOrigin();
 auto title=Label::createWithSystemFont("ARROW OUT","Arial",36);
 title->setPosition(origin.x+size.width/2,origin.y+size.height-90); addChild(title);
 status_=Label::createWithSystemFont("Tap an arrow to clear its exit path","Arial",20);
 status_->setPosition(origin.x+size.width/2,origin.y+size.height-145); addChild(status_);
 remaining_=Label::createWithSystemFont("Arrows: 3","Arial",22);
 remaining_->setPosition(origin.x+size.width/2,origin.y+95); addChild(remaining_);
 cellSize_=std::min((size.width-56)/6.0f,(size.height-280)/6.0f);
 boardOrigin_=Vec2(origin.x+(size.width-cellSize_*6)/2,origin.y+(size.height-cellSize_*6)/2-10);
 resetPuzzle();
 auto listener=EventListenerTouchOneByOne::create();
 listener->onTouchBegan=CC_CALLBACK_2(ArrowOutScene::onTouchBegan,this);
 _eventDispatcher->addEventListenerWithSceneGraphPriority(listener,this);
 return true;
}
void ArrowOutScene::resetPuzzle() {
 board_=Board{6,6,{
  Piece{{{0,2},{1,2},{1,1},{2,1}},1,0,true},
  Piece{{{4,1},{5,1}},1,1,true},
  Piece{{{2,4},{2,5}},0,2,true}
 }};
 selected_=-1;
 if(remaining_) remaining_->setString("Arrows: 3");
 if(status_) status_->setString("Clear the right-side arrow first");
 redraw();
}
bool ArrowOutScene::pointToCell(const Vec2& point,Cell& out) const {
 const auto p=convertToNodeSpace(point)-boardOrigin_;
 if(p.x<0||p.y<0||p.x>=cellSize_*6||p.y>=cellSize_*6) return false;
 out={static_cast<int>(p.x/cellSize_),static_cast<int>(p.y/cellSize_)};
 return true;
}
bool ArrowOutScene::onTouchBegan(Touch* touch,Event*) {
 Cell c{}; if(!pointToCell(touch->getLocation(),c)) return false;
 std::vector<int> occ;
 try { occ=occupancy(board_); } catch(const std::exception&) { setStatus("Puzzle data error"); return true; }
 const int pi=occ[static_cast<std::size_t>(c.y*board_.width+c.x)];
 if(pi<0) { selected_=-1; setStatus("Tap an arrow body"); redraw(); return true; }
 selected_=pi;
 const int blocker=pieceBlocker(board_,occ,pi);
 if(blocker==-2) setStatus("Invalid arrow state");
 else if(blocker>=0) setStatus("Blocked by another arrow — clear that one first");
 else if(removePiece(board_,pi)) {
  const auto left=static_cast<int>(std::count_if(board_.pieces.begin(),board_.pieces.end(),[](const Piece& p){return p.alive;}));
  remaining_->setString("Arrows: "+std::to_string(left));
  setStatus(left==0?"Puzzle solved!":"Arrow cleared — find the next exit");
  selected_=-1;
 }
 redraw(); return true;
}
void ArrowOutScene::setStatus(const std::string& s) { if(status_) status_->setString(s); }
void ArrowOutScene::redraw() {
 removeChildByTag(900,true); auto d=DrawNode::create();
 const Color4F bg(.09f,.12f,.20f,1), path(.30f,.43f,.62f,1), alive(.28f,.78f,.95f,1), chosen(1,.78f,.22f,1);
 for(int y=0;y<6;++y) for(int x=0;x<6;++x) {
  Vec2 lo=boardOrigin_+Vec2(x*cellSize_,y*cellSize_);
  d->drawSolidRect(lo+Vec2(2,2),lo+Vec2(cellSize_-2,cellSize_-2),bg);
 }
 for(std::size_t i=0;i<board_.pieces.size();++i) {
  const auto& p=board_.pieces[i]; if(!p.alive) continue;
  const Color4F col=(static_cast<int>(i)==selected_)?chosen:alive;
  for(std::size_t k=1;k<p.cells.size();++k) {
   Vec2 a=boardOrigin_+Vec2((p.cells[k-1].x+.5f)*cellSize_,(p.cells[k-1].y+.5f)*cellSize_);
   Vec2 b=boardOrigin_+Vec2((p.cells[k].x+.5f)*cellSize_,(p.cells[k].y+.5f)*cellSize_);
   d->drawSegment(a,b,cellSize_*.27f,col);
  }
  const auto h=p.cells.back(); Vec2 center=boardOrigin_+Vec2((h.x+.5f)*cellSize_,(h.y+.5f)*cellSize_);
  const float r=cellSize_*.32f; Vec2 tip=center, left=center,right=center;
  if(p.dir==0){tip.y+=r;left+=Vec2(-r*.65f,-r*.5f);right+=Vec2(r*.65f,-r*.5f);}
  if(p.dir==1){tip.x+=r;left+=Vec2(-r*.5f,r*.65f);right+=Vec2(-r*.5f,-r*.65f);}
  if(p.dir==2){tip.y-=r;left+=Vec2(r*.65f,r*.5f);right+=Vec2(-r*.65f,r*.5f);}
  if(p.dir==3){tip.x-=r;left+=Vec2(r*.5f,-r*.65f);right+=Vec2(r*.5f,r*.65f);}
  d->drawSolidTriangle(tip,left,right,col);
 }
 d->setTag(900); addChild(d,1);
}
