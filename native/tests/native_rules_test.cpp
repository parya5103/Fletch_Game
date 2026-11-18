#include "ArrowCore.hpp"
#include <cassert>
int main(){
 using namespace gogo::arrowout;
 Board b{5,4,{{{{{0,1},{1,1}},1,0,true},{{{3,1}},3,1,true}}}};
 auto occ=occupancy(b);
 assert(pieceBlocker(b,occ,0)==1);
 assert(!removePiece(b,0));
 assert(removePiece(b,1));
 occ=occupancy(b);
 assert(pieceBlocker(b,occ,0)==-1);
 assert(removePiece(b,0));
 // A body projection is not a blocker: only the head ray matters.
 Board body{4,4,{{{{{0,1},{1,1},{1,2}},1,0,true},{{{2,0}},2,1,true}}}};
 auto o2=occupancy(body);
 assert(pieceBlocker(body,o2,0)==-1);
 return 0;
}
