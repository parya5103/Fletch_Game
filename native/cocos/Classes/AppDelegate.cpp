#include "AppDelegate.h"
#include "ArrowOutScene.h"
USING_NS_CC;
void AppDelegate::initGLContextAttrs() { GLContextAttrs attrs={8,8,8,8,24,8,0}; GLView::setGLContextAttrs(attrs); }
bool AppDelegate::applicationDidFinishLaunching() {
 auto d=Director::getInstance(); auto v=d->getOpenGLView();
 if(!v) { v=GLViewImpl::create("Arrow Out"); d->setOpenGLView(v); }
 d->setAnimationInterval(1.0/60.0); v->setDesignResolutionSize(540,960,ResolutionPolicy::SHOW_ALL);
 d->runWithScene(ArrowOutScene::createScene()); return true;
}
void AppDelegate::applicationDidEnterBackground() { Director::getInstance()->stopAnimation(); }
void AppDelegate::applicationWillEnterForeground() { Director::getInstance()->startAnimation(); }
