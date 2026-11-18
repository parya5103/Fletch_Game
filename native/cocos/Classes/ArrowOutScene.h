#pragma once
#include "cocos2d.h"
#include "ArrowCore.hpp"
class ArrowOutScene final : public cocos2d::Layer {
public:
 static cocos2d::Scene* createScene();
 bool init() override;
 CREATE_FUNC(ArrowOutScene);
private:
 bool onTouchBegan(cocos2d::Touch*,cocos2d::Event*);
 bool pointToCell(const cocos2d::Vec2&,gogo::arrowout::Cell&) const;
 void redraw();
 void setStatus(const std::string&);
 bool loadLevel(int level);
 void resetPuzzle();
 int currentLevel_=1;
 gogo::arrowout::Board board_;
 cocos2d::Vec2 boardOrigin_;
 float cellSize_=0;
 cocos2d::Label* status_=nullptr;
 cocos2d::Label* remaining_=nullptr;
 int selected_=-1;
 bool levelComplete_=false;
};
